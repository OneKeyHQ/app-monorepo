import type { ITabBarDrawer } from '@onekeyhq/components';

// The profile drawer is native only. Without this stub the web app would load
// the drawer store and the content loader at startup just to return undefined.
export function useProfileTabDrawer(): ITabBarDrawer | undefined {
  return undefined;
}
