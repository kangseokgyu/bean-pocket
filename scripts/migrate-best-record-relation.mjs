import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';
const BEST_RECORD_PROPERTY = '베스트 추출';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function migrationError(message) {
  return new Error(message);
}

export function parseMigrationArgs(argv) {
  if (!Array.isArray(argv)) throw migrationError('Migration arguments are invalid.');
  let configPath = '';
  let apply = false;
  let environment = 'test';
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--apply') {
      if (apply) throw migrationError('Duplicate migration option.');
      apply = true;
      continue;
    }
    if (argument === '--config' || argument === '--environment') {
      const value = argv[++index];
      if (typeof value !== 'string' || !value.trim()) throw migrationError('Migration option value is missing.');
      if (argument === '--config') {
        if (configPath) throw migrationError('Duplicate migration option.');
        configPath = value;
      } else {
        environment = value;
      }
      continue;
    }
    throw migrationError('Unknown migration option.');
  }
  if (!configPath) throw migrationError('A config file is required.');
  if (!['test', 'operating'].includes(environment)) throw migrationError('Migration environment is invalid.');
  return { apply, configPath, environment };
}

export function migrationTarget(config, environment) {
  const selected = config?.[environment];
  if (!isRecord(selected) || typeof selected.token !== 'string' || !selected.token.trim() ||
      /[\u0000-\u001f\u007f-\u009f]/.test(selected.token) || !isRecord(selected.dataSources)) {
    throw migrationError('The selected environment config is invalid.');
  }
  const beansDataSourceId = selected.dataSources.beans;
  const recordsDataSourceId = selected.dataSources.records;
  if (typeof beansDataSourceId !== 'string' || !UUID.test(beansDataSourceId) ||
      typeof recordsDataSourceId !== 'string' || !UUID.test(recordsDataSourceId) ||
      beansDataSourceId.toLowerCase() === recordsDataSourceId.toLowerCase()) {
    throw migrationError('The selected data source config is invalid.');
  }
  return { token: selected.token.trim(), beansDataSourceId: beansDataSourceId.toLowerCase(),
    recordsDataSourceId: recordsDataSourceId.toLowerCase() };
}

function expectedSingleRelation(property, recordsDataSourceId) {
  const relation = property?.relation;
  return property?.type === 'relation' && isRecord(relation) && relation.type === 'single_property' &&
    relation.data_source_id?.toLowerCase?.() === recordsDataSourceId.toLowerCase() &&
    isRecord(relation.single_property) && !Object.hasOwn(relation, 'dual_property');
}

function schemaProperties(schema) {
  if (!isRecord(schema) || !isRecord(schema.properties)) {
    throw migrationError('Notion returned an invalid data source schema.');
  }
  return schema.properties;
}

function preservesProperties(before, after) {
  return Object.entries(before).every(([name, value]) =>
    Object.hasOwn(after, name) && isDeepStrictEqual(after[name], value));
}

function migrationProperty(recordsDataSourceId) {
  return { relation: { type: 'single_property', data_source_id: recordsDataSourceId, single_property: {} } };
}

async function requestNotion({ token, dataSourceId, method, body, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(`${NOTION_API}/data_sources/${dataSourceId}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw migrationError(method === 'PATCH'
      ? 'The schema update response was uncertain.' : 'Could not read the Notion schema.');
  }
  if (!response || !Number.isInteger(response.status) || typeof response.ok !== 'boolean') {
    throw migrationError('Notion returned an invalid response.');
  }
  if (!response.ok) throw migrationError(`Notion request failed with HTTP ${response.status}.`);
  try {
    const value = await response.json();
    schemaProperties(value);
    return value;
  } catch (error) {
    if (error?.message === 'Notion returned an invalid data source schema.') throw error;
    throw migrationError('Notion returned an invalid schema response.');
  }
}

function assertPostSchema(beforeProperties, afterProperties, recordsDataSourceId) {
  if (!preservesProperties(beforeProperties, afterProperties)) {
    throw migrationError('The post-update schema did not preserve every existing property.');
  }
  if (!expectedSingleRelation(afterProperties[BEST_RECORD_PROPERTY], recordsDataSourceId)) {
    throw migrationError('The post-update relation does not target the records data source.');
  }
}

export async function migrateBestRecordRelation({ token, beansDataSourceId, recordsDataSourceId,
  apply = false, fetchImpl = globalThis.fetch } = {}) {
  if (typeof token !== 'string' || !token.trim() || /[\u0000-\u001f\u007f-\u009f]/.test(token) ||
      typeof beansDataSourceId !== 'string' || !UUID.test(beansDataSourceId) ||
      typeof recordsDataSourceId !== 'string' || !UUID.test(recordsDataSourceId) ||
      beansDataSourceId.toLowerCase() === recordsDataSourceId.toLowerCase() ||
      typeof apply !== 'boolean' || typeof fetchImpl !== 'function') {
    throw migrationError('Migration input is invalid.');
  }
  const beansId = beansDataSourceId.toLowerCase();
  const recordsId = recordsDataSourceId.toLowerCase();
  const beforeSchema = await requestNotion({ token: token.trim(), dataSourceId: beansId, method: 'GET', fetchImpl });
  const beforeProperties = structuredClone(schemaProperties(beforeSchema));
  const existing = beforeProperties[BEST_RECORD_PROPERTY];
  if (existing !== undefined) {
    if (!expectedSingleRelation(existing, recordsId)) {
      throw migrationError('The existing best-record property conflicts with the requested relation.');
    }
    return { status: 'already-configured', applied: false, schemaPreserved: true,
      property: migrationProperty(recordsId) };
  }

  const property = migrationProperty(recordsId);
  if (!apply) return { status: 'would-add', applied: false, schemaPreserved: true, property };

  try {
    await requestNotion({ token: token.trim(), dataSourceId: beansId, method: 'PATCH',
      body: { properties: { [BEST_RECORD_PROPERTY]: property } }, fetchImpl });
  } catch (error) {
    let afterSchema;
    try {
      afterSchema = await requestNotion({ token: token.trim(), dataSourceId: beansId, method: 'GET', fetchImpl });
    } catch {
      throw migrationError('The schema update outcome is uncertain; read the schema before retrying.');
    }
    const afterProperties = schemaProperties(afterSchema);
    if (preservesProperties(beforeProperties, afterProperties) &&
        expectedSingleRelation(afterProperties[BEST_RECORD_PROPERTY], recordsId)) {
      return { status: 'updated', applied: true, schemaPreserved: true, responseUncertain: true, property };
    }
    throw error;
  }

  const afterSchema = await requestNotion({ token: token.trim(), dataSourceId: beansId, method: 'GET', fetchImpl });
  assertPostSchema(beforeProperties, schemaProperties(afterSchema), recordsId);
  return { status: 'updated', applied: true, schemaPreserved: true, property };
}

async function loadConfig(path) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch { throw migrationError('The config file could not be read.'); }
  try {
    const config = JSON.parse(text);
    if (!isRecord(config)) throw new Error();
    return config;
  } catch { throw migrationError('The config file could not be parsed.'); }
}

async function main() {
  let args;
  try { args = parseMigrationArgs(process.argv.slice(2)); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  try {
    const target = migrationTarget(await loadConfig(args.configPath), args.environment);
    const result = await migrateBestRecordRelation({ ...target, apply: args.apply });
    const action = result.status === 'would-add' ? 'would add relation'
      : result.status === 'already-configured' ? 'already configured' : 'updated';
    const relationState = result.status === 'would-add' ? 'target relation=planned' : 'target relation readback=verified';
    console.log(`${args.environment}: ${action}; apply=${args.apply ? 'yes' : 'no'}; existing properties preserved=yes; ${relationState}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Migration failed.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
