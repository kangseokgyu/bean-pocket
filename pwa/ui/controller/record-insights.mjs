import { isCurrentRecord } from '../../domain.mjs';
import { buildRecordsInsights } from '../records-insights.mjs';
import { routeLocation } from './loader.mjs';

export function emptyRecordInsights(revision = null, selectedBeanId = '') {
  return { revision, records: [], beanParents: [], nextCursor: null, hasMore: false, complete: false,
    status: 'idle', loading: false, error: '', selectedBeanId };
}

function mergeInsightRecords(previous, additions) {
  const merged = new Map((previous ?? []).filter(record => record?.id).map(record => [record.id, record]));
  for (const record of additions ?? []) if (record?.id) merged.set(record.id, record);
  return [...merged.values()];
}

export function mergeRecordInsightsPage(recordInsights, page, append = false) {
  return {
    ...recordInsights,
    records: append ? mergeInsightRecords(recordInsights.records, page.items) : [...(page.items ?? [])],
    beanParents: append ? mergeInsightRecords(recordInsights.beanParents, page.beans) : [...(page.beans ?? [])],
    nextCursor: page.nextCursor ?? null,
    hasMore: page.hasMore === true,
    complete: page.complete === true,
    status: 'ready',
    loading: false,
    error: '',
  };
}

export function projectRecordInsights(screenData, recordInsights) {
  const liveBeans = mergeInsightRecords(recordInsights.beanParents, screenData?.beans);
  const model = buildRecordsInsights(recordInsights.records, liveBeans, recordInsights.selectedBeanId,
    screenData?.recipes ?? []);
  return { ...screenData, recordInsights: { ...recordInsights, ...model } };
}

export async function includeComparisonPair(repository, records, route, signal) {
  const params = routeLocation(route).params;
  const ids = [params.get('compareSourceRecordId'), params.get('compareRecordId')]
    .filter((value, index, values) => value && values.indexOf(value) === index);
  if (ids.length !== 2 || typeof repository.getRecord !== 'function') return { items: records, beanId: null };
  const pair = await Promise.all(ids.map(async id => {
    try { return await repository.getRecord(id, { signal }); }
    catch { return null; }
  }));
  const sameBean = pair.length === 2 && pair.every(record => isCurrentRecord(record) && !record.invalidFields?.length &&
    record.beanResolution !== 'needs-confirmation' && typeof record.beanId === 'string' && record.beanId) &&
    pair[0].beanId === pair[1].beanId;
  if (!sameBean) return { items: records, beanId: null };
  const byId = new Map((records ?? []).map(record => [record.id, record]));
  for (const record of pair) byId.set(record.id, record);
  return { items: [...byId.values()], beanId: pair[0].beanId };
}

export function hasRecordInsightBean(recordInsights, data, beanId) {
  const model = buildRecordsInsights(recordInsights.records, data.beans ?? [], recordInsights.selectedBeanId,
    data.recipes ?? []);
  return model.beans.some(bean => bean.id === beanId);
}
