import { createContext, useContext } from 'react';

export type ITabSceneInfo = {
  /** Root tab route name, e.g. `Swap` — not the nested screen name. */
  tabName: string;
  /** True while the navigator holds this scene as preloaded, i.e. mounted
   * ahead of the user ever selecting the tab. */
  preloaded: boolean;
};

// Only the tab navigator knows which scenes it preloaded. Without this, a
// scene had to infer it from "mounted while blurred", which is wrong for a
// lazy module that resolves after the user has already navigated away.
export const TabSceneContext = createContext<ITabSceneInfo | undefined>(
  undefined,
);

export function useTabScene(): ITabSceneInfo | undefined {
  return useContext(TabSceneContext);
}
