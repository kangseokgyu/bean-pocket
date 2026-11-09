import { make } from '../shared/dom.mjs';
import { trashButton } from '../shared/buttons.mjs';
import { favoriteButton } from '../shared/favorite-button.mjs';
import { currentRecords, recordCard } from '../shared/record-card.mjs';

export function renderBeans(pane, data, document) {
  if (!data.beans.length) pane.append(make(document, 'p', data.screen?.hasMore
    ? '원두를 더 확인 중입니다. 더 보기로 계속 확인해 주세요.'
    : data.screen?.complete === false ? '원두 목록을 끝까지 확인하지 못했습니다. 새로고침해 주세요.'
      : '등록된 원두가 없습니다.', 'empty-state'));
  for (const bean of data.beans) {
    const card = make(document, 'article', undefined, 'bean-card');
    const header = make(document, 'div', undefined, 'entity-card-header');
    const title = make(document, 'h3');
    const link = make(document, 'a', bean.name, 'bean-card-link');
    link.setAttribute('href', `#/beans/${bean.id}`);
    link.setAttribute('aria-label', `${bean.name} 추출 기록 보기`);
    link.dataset.action = 'navigate';
    link.dataset.route = `/beans/${bean.id}`;
    title.append(link);
    header.append(favoriteButton(document, data, 'beans', bean), title, trashButton(document, 'beans', bean.id, bean.name));
    card.append(header);
    card.append(beanOverview(document, bean));
    const records = currentRecords(data).filter(record => record.beanId === bean.id);
    const count = bean.recordCount;
    const countLabel = count?.status === 'ready' ? `${count.count}개`
      : count?.status === 'error' ? '확인하지 못함'
        : count?.status === 'loading' ? '확인 중' : `${records.length}개`;
    card.append(make(document, 'p', `추출 기록 ${countLabel}`, 'bean-summary-meta'));
    pane.append(card);
  }
}

function beanOverview(document, bean) {
  const overview = make(document, 'div', undefined, 'bean-overview');
  const primary = make(document, 'dl', undefined, 'bean-primary-metadata');
  for (const [label, value] of [
    ['산지·농장', bean.origin],
    ['로스터리', bean.roaster],
  ]) {
    const field = make(document, 'div', undefined, 'bean-primary-field');
    field.append(make(document, 'dt', label), make(document, 'dd', value || '기록 없음'));
    primary.append(field);
  }
  const secondary = make(document, 'section', undefined, 'bean-secondary-info');
  const heading = make(document, 'div', undefined, 'bean-section-heading');
  heading.append(make(document, 'h4', '원두 특징'));
  const metadata = make(document, 'dl', undefined, 'bean-metadata');
  for (const [label, value] of [
    ['품종', bean.variety],
    ['프로세싱', bean.process],
    ['향미 노트', bean.tastingNotes],
  ]) {
    metadata.append(make(document, 'dt', label), make(document, 'dd', value || '기록 없음'));
  }
  secondary.append(heading, metadata);
  overview.append(primary, secondary);
  return overview;
}

function beanDetailSection(document, title, className = '') {
  const section = make(document, 'section', undefined, `bean-detail-section ${className}`.trim());
  const heading = make(document, 'div', undefined, 'bean-section-heading');
  heading.append(make(document, 'h4', title));
  section.append(heading);
  return section;
}

export function renderBeanDetail(pane, data, document, beanId) {
  const bean = data.beans.find(row => row.id === beanId);
  if (!bean) {
    pane.append(make(document, 'p', '원두를 찾을 수 없습니다. 최신 목록을 새로고침해 주세요.'));
    return;
  }
  const detail = make(document, 'article', undefined, 'bean-detail-card');
  const header = make(document, 'div', undefined, 'entity-card-header');
  header.append(make(document, 'h2', bean.name));
  detail.append(header);
  const information = beanDetailSection(document, '원두 정보');
  information.append(beanOverview(document, bean));
  detail.append(information);
  const bestSection = beanDetailSection(document, '사용자 베스트 추출', 'bean-user-best');
  if (bean.bestRecordStatus === 'ready' && bean.bestRecord) {
    bestSection.append(make(document, 'p', '이 원두에서 직접 베스트로 지정한 추출입니다.', 'bean-best-description'));
    bestSection.append(recordCard(document, bean.bestRecord, data));
  } else {
    const message = bean.bestRecordStatus === 'none' ? '아직 사용자 베스트 추출을 지정하지 않았습니다.'
      : bean.bestRecordStatus === 'unsupported'
        ? '베스트 추출을 쓰려면 원두 데이터베이스에 ‘베스트 추출’ 관계 속성을 추가해야 합니다. 기록 조회와 추출 저장은 계속 사용할 수 있습니다.'
        : bean.bestRecordStatus === 'invalid'
          ? '베스트 추출 관계가 여러 개이거나 형식이 올바르지 않습니다. Notion 관계를 확인해 주세요.'
          : bean.bestRecordStatus === 'inaccessible'
            ? '지정한 기록을 읽을 수 없습니다. 삭제되었거나 접근할 수 없는 상태일 수 있습니다.'
            : bean.bestRecordStatus === 'error'
              ? '베스트 추출 상태를 확인하지 못했습니다. 다시 불러와 주세요.'
              : '베스트 추출 상태를 확인할 수 없습니다. 다시 불러와 주세요.';
    bestSection.append(make(document, 'p', message,
      ['invalid', 'inaccessible', 'error'].includes(bean.bestRecordStatus) ? 'record-warning' : 'muted-note'));
  }
  detail.append(bestSection);
  const records = currentRecords(data).filter(record => record.beanId === bean.id).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  const history = beanDetailSection(document, '이 원두의 추출 기록', 'bean-records');
  if (!records.length) history.append(make(document, 'p', data.screen?.hasMore
    ? '기록을 더 확인 중입니다. 더 보기로 계속 확인해 주세요.'
    : data.screen?.complete === false ? '전체 기록을 확인하지 못했습니다. 새로고침해 주세요.'
      : '등록된 추출 기록이 없습니다.'));
  for (const record of records) history.append(recordCard(document, record, data));
  detail.append(history);
  pane.append(detail);
}
