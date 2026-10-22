import { schemas, relationTargets, optionalProperties, encodeProperties } from './notion-properties.mjs';

const KINDS = Object.freeze(['beans', 'bags', 'recipes', 'steps', 'records']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REJECTED = new Set([400, 401, 403, 404, 409, 413, 415, 422, 429]);
const ownErrors = new WeakSet();

function failure(code, writeState, details = {}) {
  const error = Object.freeze({ code, writeState, ...details });
  ownErrors.add(error);
  return error;
}
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function uuid(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return UUID.test(normalized) ? normalized : null;
}
function validPage(data, expectedId, sourceId) {
  if (!record(data) || data.object !== 'page' || !uuid(data.id) || !record(data.properties)) return false;
  if (expectedId && uuid(data.id) !== expectedId) return false;
  for (const flag of ['in_trash', 'archived']) {
    if (Object.hasOwn(data, flag) && typeof data[flag] !== 'boolean') return false;
  }
  if (sourceId && (!record(data.parent) || data.parent.type !== 'data_source_id' ||
      uuid(data.parent.data_source_id) !== sourceId)) return false;
  return true;
}
function serialize(body) {
  try {
    const text = JSON.stringify(body, (key, value) => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw failure('invalid-input', 'not-sent');
      return value;
    });
    if (typeof text !== 'string') throw failure('invalid-input', 'not-sent');
    if (new TextEncoder().encode(text).length > 500000) throw failure('payload-limit', 'not-sent');
    // toJSON 이후 실제 전송 값을 검사하므로 사용자 객체의 변환으로 한도를 우회할 수 없다.
    const remaining = [JSON.parse(text)];
    while (remaining.length) {
      const value = remaining.pop();
      if (Array.isArray(value)) {
        if (value.length > 100) throw failure('payload-limit', 'not-sent');
        remaining.push(...value);
      } else if (record(value)) {
        if (typeof value.text?.content === 'string' && value.text.content.length > 2000) {
          throw failure('payload-limit', 'not-sent');
        }
        remaining.push(...Object.values(value));
      }
    }
    return text;
  } catch (error) {
    if (ownErrors.has(error)) throw error;
    throw failure('invalid-input', 'not-sent');
  }
}

function createPayload(kind, data, dataSources) {
  try {
    if (typeof kind !== 'string' || !KINDS.includes(kind) || !record(data) || !record(dataSources) ||
        Object.keys(dataSources).length !== KINDS.length || !KINDS.every(key => Object.hasOwn(dataSources, key) && uuid(dataSources[key])) ||
        new Set(KINDS.map(key => uuid(dataSources[key]))).size !== KINDS.length) {
      throw failure('invalid-input', 'not-sent');
    }
    return {
      sourceId: uuid(dataSources[kind]),
      properties: encodeProperties(kind, data),
    };
  } catch (error) {
    if (ownErrors.has(error)) throw error;
    throw failure('invalid-input', 'not-sent');
  }
}

export function validateCreatePayload(kind, data, dataSources) {
  const { sourceId, properties } = createPayload(kind, data, dataSources);
  serialize({ parent: { type: 'data_source_id', data_source_id: sourceId }, properties });
  return true;
}

function retryAfter(response) {
  try {
    const value = response.headers?.get('Retry-After');
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return {};
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) && seconds >= 0 ? { retryAfterSeconds: seconds } : {};
  } catch { return {}; }
}

export class NotionClient {
  #token;
  #dataSources;
  #connectionRevision;
  #fetch;
  #timeoutMs;
  #recordBeanRelationSupported = null;

  constructor(token, options = {}) {
    try {
      const { dataSources, connectionRevision, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = options;
      if (typeof token !== 'string' || !token.trim() || /[\u0000-\u001f\u007f-\u009f]/.test(token) ||
          !record(dataSources) || Object.keys(dataSources).length !== KINDS.length ||
          !KINDS.every(kind => Object.hasOwn(dataSources, kind) && uuid(dataSources[kind])) ||
          !uuid(connectionRevision) || typeof fetchImpl !== 'function' ||
          typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw failure('invalid-config', 'not-sent');
      }
      this.#token = token.trim();
      this.#dataSources = Object.freeze(Object.fromEntries(KINDS.map(kind => [kind, uuid(dataSources[kind])])));
      this.#connectionRevision = uuid(connectionRevision);
      this.#fetch = fetchImpl;
      this.#timeoutMs = timeoutMs;
      Object.freeze(this);
    } catch { throw failure('invalid-config', 'not-sent'); }
  }

  get dataSources() { return this.#dataSources; }
  get connectionRevision() { return this.#connectionRevision; }
  get recordBeanRelationSupported() { return this.#recordBeanRelationSupported; }

  #source(kind) {
    if (typeof kind !== 'string' || !Object.hasOwn(this.#dataSources, kind)) {
      throw failure('invalid-input', 'not-sent');
    }
    return this.#dataSources[kind];
  }
  #pageId(value) {
    const id = uuid(value);
    if (!id) throw failure('invalid-input', 'not-sent');
    return id;
  }

  async #request(path, { method = 'GET', body, writing = false, validate }) {
    const text = body === undefined ? undefined : serialize(body);
    const controller = new AbortController();
    const state = writing ? 'unknown' : 'not-sent';
    const headers = Object.freeze({
      Authorization: 'Bearer ' + this.#token,
      'Notion-Version': '2025-09-03',
      'Content-Type': 'application/json',
    });
    const init = Object.freeze({
      method, headers, redirect: 'error', cache: 'no-store', credentials: 'omit',
      signal: controller.signal, ...(text === undefined ? {} : { body: text }),
    });
    let httpStatus, timer;
    const startedAt = Date.now();
    const status = () => httpStatus === undefined ? {} : { httpStatus };
    const checkDeadline = () => {
      if (Date.now() - startedAt >= this.#timeoutMs) {
        controller.abort();
        throw failure('timeout', state, status());
      }
    };
    const run = async () => {
      let phase = 'fetch';
      try {
        const response = await this.#fetch.call(globalThis, 'https://api.notion.com/v1' + path, init);
        checkDeadline();
        phase = 'response';
        if (!record(response) || !Number.isInteger(response.status) || response.status < 100 ||
            response.status > 599 || typeof response.ok !== 'boolean' ||
            response.ok !== (response.status >= 200 && response.status < 300)) {
          throw failure('invalid-response', state);
        }
        httpStatus = response.status;
        if (!response.ok) {
          throw failure(response.status === 429 ? 'rate-limited' : REJECTED.has(response.status) ? 'http-rejected' : 'http-error',
            writing && REJECTED.has(response.status) ? 'rejected' : state,
            { httpStatus, ...retryAfter(response) });
        }
        phase = 'body';
        const data = await response.json();
        checkDeadline();
        phase = 'shape';
        if (!validate(data)) throw failure('invalid-response', state, status());
        checkDeadline();
        return data;
      } catch (error) {
        if (ownErrors.has(error)) throw error;
        throw failure(phase === 'fetch' ? 'network-unconfirmed' : 'invalid-response', state, status());
      }
    };
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(failure('timeout', state, status()));
        controller.abort();
      }, this.#timeoutMs);
    });
    try { return await Promise.race([run(), timeout]); }
    finally { clearTimeout(timer); }
  }

  async verify() {
    for (const kind of KINDS) {
      const sourceId = this.#dataSources[kind];
      let recordBeanRelationSupported = false;
      await this.#request('/data_sources/' + sourceId, {
        validate: data => {
          if (!record(data) || data.object !== 'data_source' || uuid(data.id) !== sourceId || !record(data.properties)) return false;
          return Object.entries(schemas[kind]).every(([field, [name, type]]) => {
            const property = data.properties[name];
            if (property === undefined && optionalProperties[kind]?.includes(field)) return true;
            if (!record(property) || property.type !== type) return false;
            if (kind === 'records' && field === 'beanId') recordBeanRelationSupported = true;
            if (type !== 'relation') return true;
            return record(property.relation) &&
              uuid(property.relation.data_source_id) === this.#dataSources[relationTargets[kind][field]];
          });
        },
      });
      if (kind === 'records') this.#recordBeanRelationSupported = recordBeanRelationSupported;
    }
    return true;
  }

  async queryAll(kind) {
    const sourceId = this.#source(kind), rows = [], cursors = new Set();
    let cursor;
    do {
      const data = await this.#request('/data_sources/' + sourceId + '/query', {
        method: 'POST', body: { page_size: 100, ...(cursor === undefined ? {} : { start_cursor: cursor }) },
        validate: data => {
          if (!record(data) || data.object !== 'list' || !Array.isArray(data.results) ||
              data.results.length > 100 || typeof data.has_more !== 'boolean' ||
              !data.results.every(item => validPage(item, undefined, sourceId))) return false;
          if (data.request_status !== undefined) {
            if (!record(data.request_status)) return false;
            if (data.request_status.type === 'incomplete') throw failure('query-incomplete', 'not-sent');
            if (data.request_status.type !== 'complete') return false;
          }
          if (data.has_more) {
            if (typeof data.next_cursor !== 'string' || !data.next_cursor.trim() || cursors.has(data.next_cursor)) {
              throw failure('pagination-error', 'not-sent');
            }
          } else if (data.next_cursor !== null) return false;
          return true;
        },
      });
      rows.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
      if (cursor !== undefined) cursors.add(cursor);
    } while (cursor !== undefined);
    return rows;
  }

  async createPage(kind, domainData) {
    const sourceId = this.#source(kind);
    if (kind === 'records' && this.#recordBeanRelationSupported !== true) {
      throw failure('schema-unsupported', 'not-sent');
    }
    let payload;
    try {
      payload = createPayload(kind, domainData, this.#dataSources);
    } catch { throw failure('invalid-input', 'not-sent'); }
    return this.#request('/pages', {
      method: 'POST', writing: true,
      body: { parent: { type: 'data_source_id', data_source_id: sourceId }, properties: payload.properties },
      validate: data => validPage(data, undefined, sourceId) && data.in_trash !== true && data.archived !== true,
    });
  }

  async getPage(value) {
    const id = this.#pageId(value);
    return this.#request('/pages/' + id, { validate: data => validPage(data, id) });
  }

  async archiveBean(value) {
    const id = this.#pageId(value);
    const sourceId = this.#dataSources.beans;
    const page = await this.getPage(id);
    if (!validPage(page, id, sourceId) || page.in_trash !== false || page.archived !== false) {
      throw failure('invalid-delete-target', 'not-sent');
    }
    return this.#request('/pages/' + id, {
      method: 'PATCH', writing: true, body: { in_trash: true },
      validate: data => validPage(data, id, sourceId) && data.in_trash === true,
    });
  }

  // T18은 호출 전에 journal에서 현재 작업·연결의 확인된 신규 ID임을 검증한다.
  async archiveCreatedPage(value) {
    const id = this.#pageId(value);
    return this.#request('/pages/' + id, {
      method: 'PATCH', writing: true, body: { in_trash: true },
      validate: data => validPage(data, id) && data.in_trash === true,
    });
  }
}
