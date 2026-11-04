import { schemas, relationTargets } from '../../pwa/data/notion-properties.mjs';
import { DATA_SOURCES } from './notion-config.mjs';

export { DATA_SOURCES };
export const TEST_REVISION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const testConnection = () => ({ schemaVersion: 1, revision: TEST_REVISION,
  token: 'test-only-credential', dataSources: { ...DATA_SOURCES } });

// In-memory native API doubles. Product code still uses its real adapters.
export function memoryPlatform({ initialized = true } = {}) {
  const files = new Map(initialized ? [
    ['connection.json', JSON.stringify(testConnection())],
    ['submission-journal.json', JSON.stringify({ schemaVersion: 1,
      activeConnectionRevision: TEST_REVISION, connectionGuard: null, operations: [] })],
  ] : []);
  const missing = () => Object.assign(new Error('Missing test file'), { name: 'NotFoundError' });
  const storage = { async getDirectory() {
    return { async getDirectoryHandle() {
      return { async getFileHandle(name, { create = false } = {}) {
        if (!files.has(name)) { if (!create) throw missing(); files.set(name, ''); }
        return {
          async getFile() { return { async text() { return files.get(name); } }; },
          async createWritable() {
            let staged;
            return { async write(text) { staged = text; },
              async close() { files.set(name, staged); }, async abort() {} };
          },
        };
      } };
    } };
  } };
  let held = false;
  const locks = { async request(name, options, action) {
    if (held) return action(null);
    held = true;
    try { return await action({ name }); } finally { held = false; }
  } };
  return { files, storage, locks, journal: () => JSON.parse(files.get('submission-journal.json')) };
}

function matchesFilter(row, filter) {
  if (!filter) return true;
  if (filter.and) return filter.and.every(child => matchesFilter(row, child));
  const value = row.properties[filter.property];
  if (filter.checkbox) return value?.checkbox === filter.checkbox.equals;
  if (filter.title) return (value?.title ?? []).map(part => part.plain_text ?? part.text?.content ?? '').join('').includes(filter.title.contains);
  if (filter.relation) return value?.relation?.some(part => part.id === filter.relation.contains) ?? false;
  return true;
}

export function fakePwaNotion({ missingProperties = {}, strictProjection = false } = {}) {
  const rows = [];
  const calls = [];
  let sequence = 0;
  const fake = { rows, calls, intercept: null, async fetch(url, options = {}) {
    const requestUrl = new URL(url);
    const pathname = requestUrl.pathname;
    const queryProperties = requestUrl.searchParams.getAll('filter_properties');
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    const call = { pathname, method, body, queryProperties };
    calls.push(call);
    const intercepted = await fake.intercept?.(call);
    if (intercepted) return intercepted;
    const parts = pathname.split('/');
    if (parts[2] === 'data_sources') {
      const id = parts[3];
      const kind = Object.keys(DATA_SOURCES).find(key => DATA_SOURCES[key] === id);
      if (!kind) return Response.json({}, { status: 404 });
      const fields = Object.entries(schemas[kind]).filter(([, [name]]) => !missingProperties[kind]?.includes(name));
      if (method === 'GET') {
        const properties = Object.fromEntries(fields.map(([field, [name, type]]) =>
          [name, { type, [type]: type === 'relation' ? { data_source_id: DATA_SOURCES[relationTargets[kind][field]] } : {} }]));
        return Response.json({ object: 'data_source', id, properties });
      }
      if (queryProperties.some(name => !fields.some(([, [available]]) => available === name))) {
        return Response.json({ message: 'Unknown projection property' }, { status: 400 });
      }
      const results = rows.filter(row => row.parent.data_source_id === id && !row.in_trash && matchesFilter(row, body?.filter));
      const projected = strictProjection ? results.map(row => ({ ...row,
        properties: Object.fromEntries(Object.entries(row.properties).filter(([name]) =>
          fields.some(([, [available]]) => available === name) && (!queryProperties.length || queryProperties.includes(name)))),
      })) : results;
      return Response.json({ object: 'list', results: projected,
        has_more: false, next_cursor: null });
    }
    if (pathname === '/v1/pages' && method === 'POST') {
      const id = 'cccccccc-cccc-4ccc-8ccc-' + String(++sequence).padStart(12, '0');
      const properties = Object.fromEntries(Object.entries(body.properties).map(([name, property]) => {
        const type = Object.keys(property)[0];
        return [name, { type, ...property, ...(type === 'relation' ? { has_more: false } : {}) }];
      }));
      const row = { object: 'page', id, parent: body.parent, properties,
        archived: false, in_trash: false, last_edited_time: '2026-10-19T00:00:00.000Z' };
      rows.push(row);
      return Response.json(row);
    }
    const row = rows.find(item => item.id === parts[3]);
    if (!row) return Response.json({}, { status: 404 });
    if (method === 'PATCH') {
      if (body.in_trash !== undefined) row.in_trash = body.in_trash;
      for (const [name, property] of Object.entries(body.properties ?? {})) {
        const type = Object.keys(property)[0];
        row.properties[name] = { type, ...property, ...(type === 'relation' ? { has_more: false } : {}) };
      }
    }
    return Response.json(row);
  } };
  return fake;
}
