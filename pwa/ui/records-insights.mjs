import { isCurrentRecord } from '../domain.mjs';

const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const validRating = value => Number.isInteger(value) && value >= 1 && value <= 5;
const byId = (left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
const byDateAscending = (left, right) => left.date.localeCompare(right.date) || byId(left, right);
const byDateDescending = (left, right) => right.date.localeCompare(left.date) || byId(left, right);

function snapshotBean(record) {
  return record.snapshot?.version === 2 ? record.snapshot.bean : null;
}

function recordBeanName(record, liveBeans) {
  return liveBeans.get(record.beanId)?.name || snapshotBean(record)?.name || '원두 이름 확인 필요';
}

function ratingRecord(record) {
  return validDate(record.date) && validRating(record.rating);
}

export function buildRecordsInsights(records, beans = [], selectedBeanId = '') {
  const rows = Array.isArray(records) ? records : [];
  const liveBeans = new Map((Array.isArray(beans) ? beans : []).filter(bean => bean?.id).map(bean => [bean.id, bean]));
  const eligible = rows.filter(record => isCurrentRecord(record) && record.beanResolution !== 'needs-confirmation' &&
    typeof record.beanId === 'string' && record.beanId && validDate(record.date));
  const byBean = new Map();
  for (const record of eligible) {
    const current = byBean.get(record.beanId);
    if (!current || record.date > current.date || (record.date === current.date && byId(record, current) < 0)) {
      byBean.set(record.beanId, record);
    }
  }
  const beanOptions = [...byBean.entries()].map(([id, latestRecord]) => ({
    id,
    name: recordBeanName(latestRecord, liveBeans),
    latestDate: latestRecord.date,
  })).sort((left, right) => right.latestDate.localeCompare(left.latestDate) || byId(left, right)).slice(0, 3);
  const selectedBean = beanOptions.find(bean => bean.id === selectedBeanId) ?? beanOptions[0] ?? null;
  const selectedRows = selectedBean ? eligible.filter(record => record.beanId === selectedBean.id) : [];
  const ratedRows = selectedRows.filter(ratingRecord);
  const trend = ratedRows.map(record => ({ id: record.id, date: record.date, rating: record.rating, record }))
    .sort(byDateAscending);
  const comparisonRecords = [...ratedRows].sort(byDateDescending);
  const bestRecord = [...ratedRows].sort((left, right) => right.rating - left.rating ||
    right.date.localeCompare(left.date) || byId(left, right))[0] ?? null;

  return {
    loadedCount: rows.length,
    eligibleCount: eligible.length,
    excludedCount: rows.length - eligible.length,
    beans: beanOptions,
    selectedBeanId: selectedBean?.id ?? '',
    selectedBean,
    selectedRecordCount: selectedRows.length,
    ratedRecordCount: ratedRows.length,
    trend,
    bestRecord,
    comparisonRecords,
  };
}

export function layoutRatingTrend(points, { width = 640, height = 260 } = {}) {
  const margin = { left: 38, right: 12, top: 12, bottom: 32 };
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = Math.max(1, height - margin.top - margin.bottom);
  const dates = (Array.isArray(points) ? points : []).filter(point => validDate(point.date));
  const firstTime = dates.length ? Date.parse(`${dates[0].date}T00:00:00Z`) : 0;
  const lastTime = dates.length ? Math.max(...dates.map(point => Date.parse(`${point.date}T00:00:00Z`))) : firstTime;
  const span = lastTime - firstTime;
  return {
    width,
    height,
    margin,
    plotWidth,
    plotHeight,
    plotLeft: margin.left,
    plotRight: margin.left + plotWidth,
    plotTop: margin.top,
    plotBottom: margin.top + plotHeight,
    yTicks: [1, 2, 3, 4, 5],
    points: dates.map(point => ({ ...point,
      x: margin.left + (span ? (Date.parse(`${point.date}T00:00:00Z`) - firstTime) / span * plotWidth : plotWidth / 2),
      y: margin.top + (5 - point.rating) / 4 * plotHeight,
    })),
  };
}
