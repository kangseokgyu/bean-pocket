export class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.safeToRetry = true;
  }
}

export function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InputError(`${label}을(를) 입력해 주세요.`);
  }
  return value.trim();
}

export function optionalText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function positiveNumber(value, label) {
  if (!['number', 'string'].includes(typeof value) || value === ''
      || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw new InputError(`${label}은(는) 0보다 큰 숫자여야 합니다.`);
  }
  return Number(value);
}

export function parseTime(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+:[0-5]\d$/.test(value)) {
    const [minutes, seconds] = value.split(':').map(Number);
    const total = minutes * 60 + seconds;
    if (Number.isSafeInteger(total)) return total;
  }
  throw new InputError('시간은 0:30처럼 분:초로 입력해 주세요.');
}

export function formatTime(value) {
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function calculateSteps(steps) {
  if (!Array.isArray(steps) || !steps.length) {
    throw new InputError('물 붓기 단계를 하나 이상 입력해 주세요.');
  }
  let previousSeconds = -1;
  let cumulativeWater = 0;
  return steps.map((step, index) => {
    if (!step || typeof step !== 'object') throw new InputError('물 붓기 단계를 확인해 주세요.');
    const seconds = parseTime(step.time ?? step.seconds);
    if (index === 0 && seconds !== 0) throw new InputError('첫 단계는 0:00에 시작해 주세요.');
    if (seconds <= previousSeconds) throw new InputError('단계 시간은 이전 단계보다 늦어야 합니다.');
    const water = positiveNumber(step.water, '단계 물 양');
    cumulativeWater += water;
    if (!Number.isFinite(cumulativeWater)) throw new InputError('단계 물 양이 너무 큽니다.');
    const calculated = {
      name: optionalText(step.name) || `${index + 1}단계`,
      order: index + 1,
      seconds,
      interval: index === 0 ? 0 : seconds - previousSeconds,
      water,
      cumulativeWater: Number(cumulativeWater.toFixed(6)),
    };
    previousSeconds = seconds;
    return calculated;
  });
}

export function validateBean(data) {
  return {
    name: requiredText(data.name, '원두 이름'),
    roaster: optionalText(data.roaster),
    origin: optionalText(data.origin),
    variety: optionalText(data.variety),
    process: optionalText(data.process),
    tastingNotes: optionalText(data.tastingNotes),
  };
}

export function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new InputError('유효한 날짜를 입력해 주세요.');
  }
  return value;
}

export function validateRecipe(data) {
  const temperature = positiveNumber(data.temperature, '물 온도');
  if (temperature > 100) throw new InputError('물 온도는 0℃ 초과 100℃ 이하여야 합니다.');
  const totalWater = positiveNumber(data.totalWater, '총 물 양');
  const steps = calculateSteps(data.steps);
  if (Math.abs(steps.at(-1).cumulativeWater - totalWater) > 0.000001) {
    throw new InputError('단계별 물 양의 합계가 총 물 양과 같아야 합니다.');
  }
  return {
    name: requiredText(data.name, '레시피 이름'),
    dripper: optionalText(data.dripper),
    dose: positiveNumber(data.dose, '원두 사용량'),
    grind: optionalText(data.grind),
    grinder: optionalText(data.grinder),
    grinderSetting: optionalText(data.grinderSetting),
    extractionGuide: optionalText(data.extractionGuide),
    microns: data.microns === undefined || data.microns === null || data.microns === ''
      ? null : positiveNumber(data.microns, '분쇄 입자 굵기'),
    temperature,
    totalWater,
    steps,
  };
}

// Stored stages must be complete as well as valid input: no gaps, duplicates,
// or manually edited derived values. Do not repair them silently before a snapshot.
export function validateStoredRecipe(recipe) {
  const validated = validateRecipe(recipe);
  recipe.steps.forEach((step, index) => {
    const expected = validated.steps[index];
    if (step.order !== index + 1 || step.interval !== expected.interval
        || !Number.isFinite(step.cumulativeWater)
        || Math.abs(step.cumulativeWater - expected.cumulativeWater) > 0.000001) {
      throw new InputError('레시피의 단계 순서와 누적 물 양이 완성되지 않았습니다.');
    }
  });
  return recipe;
}

export function validateRecord(data, recipe, bean) {
  if (!recipe) throw new InputError('레시피를 찾을 수 없습니다.');
  const beanId = requiredText(bean?.id, '원두');
  const rating = Number(data.rating);
  if (!['number', 'string'].includes(typeof data.rating) || data.rating === ''
      || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new InputError('별점은 정수 1~5점으로 선택해 주세요.');
  }
  return {
    beanId,
    recipeId: recipe.id,
    date: validateDate(data.date),
    rating,
    cupNote: optionalText(data.cupNote),
  };
}

export function validateStoredSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new InputError('기록 스냅샷 형식이 올바르지 않습니다.');
  }
  if (snapshot.version === 1) {
    validateStoredRecipe(snapshot);
  } else if (snapshot.version === 2) {
    if (!snapshot.bean || typeof snapshot.bean !== 'object' || Array.isArray(snapshot.bean)
        || !snapshot.recipe || typeof snapshot.recipe !== 'object' || Array.isArray(snapshot.recipe)) {
      throw new InputError('기록 스냅샷 형식이 올바르지 않습니다.');
    }
    validateBean(snapshot.bean);
    validateStoredRecipe(snapshot.recipe);
  } else {
    throw new InputError('지원하지 않는 기록 스냅샷입니다.');
  }
  return structuredClone(snapshot);
}

export function recordValidationIssues(record) {
  const issues = [];
  try { validateDate(record?.date); }
  catch { issues.push('date'); }
  if (!Number.isInteger(record?.rating) || record.rating < 1 || record.rating > 5) {
    issues.push('rating');
  }
  return issues;
}

export function copyRecipe(recipe) {
  const copy = structuredClone(recipe);
  delete copy.id;
  delete copy.stats;
  copy.steps = copy.steps.map(step => {
    delete step.id;
    delete step.recipeId;
    return step;
  });
  return copy;
}

export function createSnapshot(bean, recipe) {
  if (!bean || !recipe) throw new InputError('원두와 레시피를 확인해 주세요.');
  const beanSnapshot = structuredClone(bean);
  const recipeSnapshot = structuredClone(recipe);
  recipeSnapshot.extractionGuide = optionalText(recipeSnapshot.extractionGuide);
  delete recipeSnapshot.stats;
  delete recipeSnapshot.beanId;
  return { version: 2, recordGeneration: CURRENT_RECORD_GENERATION, bean: beanSnapshot, recipe: recipeSnapshot };
}

export const CURRENT_RECORD_GENERATION = 'bagless-v1';

export function isCurrentRecord(record) {
  return record?.snapshotStatus === 'valid' && record.snapshot?.recordGeneration === CURRENT_RECORD_GENERATION;
}

export function summarizeRatings(records, recipeId) {
  const ratings = records
    .filter(record => isCurrentRecord(record) && record.recipeId === recipeId && Number.isInteger(record.rating)
      && record.rating >= 1 && record.rating <= 5)
    .map(record => record.rating);
  return {
    count: ratings.length,
    average: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
  };
}
