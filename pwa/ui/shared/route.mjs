export function routePath(route) {
  const path = String(route ?? '/home').split('?', 1)[0];
  return path || '/home';
}

export function routeParams(route) {
  return new URLSearchParams(String(route ?? '').split('?').slice(1).join('?'));
}

export function normalizeRoute(route) {
  const value = typeof route === 'string' ? route.trim() : '';
  const [rawPath, ...queryParts] = value.split('?');
  const path = rawPath || '/home';
  if (!path.startsWith('/') || path === '/') return '/home';
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const query = queryParts.join('?');
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}
