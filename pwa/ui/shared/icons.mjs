const ACTION_ICON_PATHS = Object.freeze({
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM17 21v-8H7v8ZM7 3v5h8',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M4 12l5 5 11-11',
  warning: 'M12 3 22 20H2L12 3Zm0 6v5m0 3h.01',
  edit: 'm16 3 5 5M4 15 16 3l5 5L9 20l-6 1 1-6Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
});

const NAVIGATION_ICON_PATHS = Object.freeze({
  home: 'M3 10.5 12 3l9 7.5M5 9v12h14V9M9 21v-7h6v7',
  beans: 'M20.6 7.3c-1.2-3.7-5.9-5-10.2-2.7S2 10.9 3.2 14.6s5.9 5 10.2 2.7 8.4-6.3 7.2-10ZM7.2 17c.8-3.8 3.5-7.7 7.6-10.5',
  brew: 'M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm12 2h2a3 3 0 0 1 0 6h-3M4 21h14',
  recipes: 'M5 4.5h12a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2v-13ZM5 4.5v13a2 2 0 0 0 2 2m3-11h5m-5 4h5',
  records: 'M12 8v4l2.5 1.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
});

export function settingsIcon(document) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'settings-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const gear = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  gear.setAttribute('d', 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z');
  const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  center.setAttribute('cx', '12');
  center.setAttribute('cy', '12');
  center.setAttribute('r', '4');
  svg.append(gear, center);
  return svg;
}

export function actionIcon(document, name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ACTION_ICON_PATHS[name]);
  if (name === 'check') path.setAttribute('pathLength', '1');
  svg.append(path);
  return svg;
}

export function navigationIcon(document, name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'nav-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', NAVIGATION_ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

export function decorativeSvg(document, viewBox, className, pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const entry of pathData) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', typeof entry === 'string' ? entry : entry.d);
    if (typeof entry !== 'string' && entry.marker) path.setAttribute(`data-${entry.marker}`, '');
    svg.append(path);
  }
  return svg;
}

export function trashIcon(document) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7');
  icon.append(path);
  return icon;
}
