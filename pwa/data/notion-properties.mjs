// Only writable properties appear here. Formula and rollup fields stay untouched.
export const schemas = {
  beans: {
    name: ['원두 이름', 'title'],
    roaster: ['로스터리', 'rich_text'],
    origin: ['원산지·농장', 'rich_text'],
    variety: ['품종', 'rich_text'],
    process: ['가공 방식', 'rich_text'],
    tastingNotes: ['로스터리 향미 노트', 'rich_text'],
  },
  bags: {
    name: ['봉지 이름', 'title'],
    beanId: ['원두', 'relation'],
    roastedOn: ['로스팅 날짜', 'date'],
  },
  recipes: {
    name: ['레시피 이름', 'title'],
    beanId: ['원두', 'relation'],
    dripper: ['드리퍼', 'rich_text'],
    dose: ['원두 사용량(g)', 'number'],
    grind: ['분쇄도', 'rich_text'],
    grinder: ['그라인더 이름', 'rich_text'],
    grinderSetting: ['그라인더 설정값', 'rich_text'],
    microns: ['분쇄 입자 굵기(μm)', 'number'],
    temperature: ['물 온도(℃)', 'number'],
    totalWater: ['총 물 양(g)', 'number'],
  },
  steps: {
    name: ['단계 이름', 'title'],
    recipeId: ['레시피', 'relation'],
    order: ['순서', 'number'],
    seconds: ['누적 시간(초)', 'number'],
    interval: ['간격(초)', 'number'],
    water: ['이번에 붓는 물 양(g)', 'number'],
    cumulativeWater: ['누적 물 양(g)', 'number'],
  },
  records: {
    name: ['기록 이름', 'title'],
    beanId: ['원두', 'relation'],
    recipeId: ['레시피', 'relation'],
    bagId: ['원두 봉지', 'relation'],
    date: ['날짜', 'date'],
    rating: ['별점', 'number'],
    cupNote: ['컵노트', 'rich_text'],
    snapshot: ['당시 레시피 스냅샷', 'rich_text'],
  },
};

function richText(value) {
  const text = String(value ?? '');
  const chunks = [];
  for (let index = 0; index < text.length; index += 2000) {
    chunks.push({ type: 'text', text: { content: text.slice(index, index + 2000) } });
  }
  return chunks;
}

export function encodeProperties(kind, data) {
  const properties = {};
  for (const [key, [name, type]] of Object.entries(schemas[kind])) {
    // New recipes are independent of beans; omit the legacy relation so its
    // stored values remain untouched and old schemas need not expose it.
    if (kind === 'recipes' && key === 'beanId') continue;
    const value = data[key];
    let encoded;
    if (type === 'title' || type === 'rich_text') {
      encoded = richText(key === 'snapshot' ? JSON.stringify(value ?? null) : value);
    } else if (type === 'relation') {
      encoded = value ? [{ id: value }] : [];
    } else if (type === 'date') {
      encoded = value ? { start: value } : null;
    } else {
      encoded = value ?? null;
    }
    properties[name] = { [type]: encoded };
  }
  return properties;
}

export function decodePage(kind, page) {
  const result = { id: page.id };
  for (const [key, [name, type]] of Object.entries(schemas[kind])) {
    const property = page.properties?.[name] ?? {};
    if (type === 'title' || type === 'rich_text') {
      const text = (Array.isArray(property[type]) ? property[type] : []).map(item =>
        typeof item?.plain_text === 'string' ? item.plain_text
          : typeof item?.text?.content === 'string' ? item.text.content : '').join('');
      if (key === 'snapshot') {
        try {
          result[key] = JSON.parse(text);
        } catch {
          result[key] = null;
        }
      } else {
        result[key] = text;
      }
    } else if (type === 'relation') {
      result[key] = Array.isArray(property.relation) && property.relation.length === 1 &&
        typeof property.relation[0]?.id === 'string' ? property.relation[0].id : null;
    } else if (type === 'date') {
      result[key] = typeof property.date?.start === 'string' ? property.date.start : null;
    } else {
      result[key] = typeof property.number === 'number' && Number.isFinite(property.number) ? property.number : null;
    }
  }
  return result;
}

export const relationTargets = {
  bags: { beanId: 'beans' },
  recipes: { beanId: 'beans' },
  steps: { recipeId: 'recipes' },
  records: { beanId: 'beans', recipeId: 'recipes', bagId: 'bags' },
};

// Older user databases can be read without the additive relations. Record
// creation requires records.beanId support and is gated by client.verify().
export const optionalProperties = {
  recipes: ['beanId'],
  records: ['beanId'],
};
