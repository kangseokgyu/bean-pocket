export const make = (document, tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
};

export const makeSpinner = document => {
  const spinner = make(document, 'span', undefined, 'pull-refresh-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 12; index++) {
    const spoke = make(document, 'span', undefined, 'pull-refresh-spoke');
    spoke.setAttribute('style', `transform: rotate(${index * 30}deg); opacity: ${(index + 1) / 12}`);
    spinner.append(spoke);
  }
  return spinner;
};
