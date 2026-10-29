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

function snapshotRecipe(record) {
  if (record.snapshot?.version === 2) return record.snapshot.recipe;
  return record.snapshot?.version === 1 ? record.snapshot : null;
}

function recordBeanName(record, liveBeans) {
  return snapshotBean(record)?.name || liveBeans.get(record.beanId)?.name || '원두 이름 확인 필요';
}

function ratingRecord(record) {
  return validDate(record.date) && validRating(record.rating);
}

export function buildRecordsInsights(records, beans = [], selectedBeanId = '', recipes = []) {
  const rows = Array.isArray(records) ? records : [];
  const liveBeans = new Map((Array.isArray(beans) ? beans : []).filter(bean => bean?.id).map(bean => [bean.id, bean]));
  const liveRecipes = new Map((Array.isArray(recipes) ? recipes : []).filter(recipe => recipe?.id)
    .map(recipe => [recipe.id, recipe]));
  const eligible = rows.filter(record => isCurrentRecord(record) && record.beanResolution !== 'needs-confirmation' &&
    typeof record.beanId === 'string' && record.beanId && validDate(record.date));
  const recordsByBean = new Map();
  for (const record of eligible) {
    const beanRecords = recordsByBean.get(record.beanId) ?? [];
    beanRecords.push(record);
    recordsByBean.set(record.beanId, beanRecords);
  }
  const beanOptions = [...recordsByBean.entries()].map(([id, beanRecords]) => {
    const latestRecord = [...beanRecords].sort(byDateDescending)[0];
    const historicalBean = snapshotBean(latestRecord);
    const liveBean = liveBeans.get(id);
    const recordRecipe = snapshotRecipe(latestRecord);
    return {
      id,
      name: recordBeanName(latestRecord, liveBeans),
      origin: historicalBean?.origin || liveBean?.origin || '',
      roaster: historicalBean?.roaster || liveBean?.roaster || '',
      variety: historicalBean?.variety || liveBean?.variety || '',
      process: historicalBean?.process || liveBean?.process || '',
      tastingNotes: historicalBean?.tastingNotes || liveBean?.tastingNotes || '',
      latestDate: latestRecord.date,
      latestRecipeName: recordRecipe?.name || liveRecipes.get(latestRecord.recipeId)?.name ||
        '기록 당시 레시피 확인 필요',
      latestRating: validRating(latestRecord.rating) ? latestRecord.rating : null,
      latestRatingLabel: validRating(latestRecord.rating) ? `${latestRecord.rating}/5`
        : latestRecord.rating == null ? '별점 없음' : '별점 확인 필요',
      recordCount: beanRecords.length,
    };
  }).sort((left, right) => right.latestDate.localeCompare(left.latestDate) || byId(left, right)).slice(0, 3);
  const selectedBean = beanOptions.find(bean => bean.id === selectedBeanId) ?? beanOptions[0] ?? null;
  const selectedRows = selectedBean ? recordsByBean.get(selectedBean.id) ?? [] : [];
  const ratedRows = selectedRows.filter(ratingRecord);
  const trend = ratedRows.map(record => ({ id: record.id, date: record.date, rating: record.rating, record }))
    .sort(byDateAscending);
  const comparisonRecords = selectedRows.filter(record => record.rating == null || validRating(record.rating)).sort(byDateDescending);
  const recipeOptions = new Map();
  for (const record of comparisonRecords) {
    const recipeId = record.recipeId || snapshotRecipe(record)?.id;
    if (!recipeId || recipeOptions.has(recipeId)) continue;
    recipeOptions.set(recipeId, { id: recipeId,
      name: snapshotRecipe(record)?.name || liveRecipes.get(recipeId)?.name || '레시피 이름 확인 필요' });
  }
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
    averageRating: ratedRows.length ? ratedRows.reduce((sum, record) => sum + record.rating, 0) / ratedRows.length : null,
    trend,
    bestRecord,
    comparisonRecords,
    recipeOptions: [...recipeOptions.values()].sort((left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
  };
}

export function layoutRatingTrend(points, { width = 640, height = 260 } = {}) {
  const margin = { left: 46, right: 24, top: 30, bottom: 48 };
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
