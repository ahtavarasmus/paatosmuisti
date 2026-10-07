import { useEffect, useState } from 'react';

/** Three views, addressed by the hash so the page works from any static host. */
export type Route = { name: 'home' } | { name: 'decision'; id: string } | { name: 'new' };

export function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path.startsWith('paatos/')) return { name: 'decision', id: decodeURIComponent(path.slice('paatos/'.length)) };
  if (path === 'uusi') return { name: 'new' };
  return { name: 'home' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'decision':
      return `#/paatos/${encodeURIComponent(route.id)}`;
    case 'new':
      return '#/uusi';
    default:
      return '#/';
  }
}

export function go(route: Route): void {
  location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash));
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
