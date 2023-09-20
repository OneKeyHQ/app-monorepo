import type { TabRoutes } from './routesEnum';

export function buildAppRootTabName(name: TabRoutes) {
  return `tab-${name}`;
}
