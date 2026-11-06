const RECIPE_FIELDS = Object.freeze(['name', 'dripper', 'dose', 'grind', 'grinder', 'grinderSetting',
  'extractionGuide', 'microns', 'temperature', 'totalWater']);
const STEP_FIELDS = Object.freeze(['name', 'order', 'seconds', 'interval', 'water', 'cumulativeWater']);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

export function recipePageValues(recipe) {
  return Object.fromEntries(RECIPE_FIELDS.map(field => [field,
    field === 'extractionGuide' ? recipe[field] ?? ''
      : ['dripper', 'grind', 'grinder', 'grinderSetting'].includes(field) ? recipe[field] ?? ''
        : recipe[field] ?? null]));
}

export function stepPageValues(step) {
  return Object.fromEntries(STEP_FIELDS.map(field => [field, field === 'name' ? step[field] ?? '' : step[field]]));
}

export function recipeEditState(recipe, originalStepIds = []) {
  const existing = new Set(originalStepIds.map(id => String(id).toLowerCase()));
  return {
    id: String(recipe.id).toLowerCase(),
    beanId: recipe.beanId == null ? null : String(recipe.beanId).toLowerCase(),
    favorite: typeof recipe.favorite === 'boolean' ? recipe.favorite : null,
    ...recipePageValues(recipe),
    steps: [...recipe.steps].sort((first, second) => first.order - second.order).map(step => ({
      id: step.id && existing.has(String(step.id).toLowerCase()) ? String(step.id).toLowerCase() : null,
      ...stepPageValues(step),
    })),
  };
}

export async function recipeFingerprint(value, cryptoImpl = globalThis.crypto) {
  const digest = await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(value))));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const recipeEditableFields = RECIPE_FIELDS;
export const stepEditableFields = STEP_FIELDS;
