import type { ETabRoutes } from '../Root/Tab/Routes';

export function buildAppRootTabName(name: ETabRoutes) {
  return `tab-${name}`;
}
