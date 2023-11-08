import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IRouteInfo = {
  currentTab: string;
};
export const { target: routeAtom, use: useRouteAtom } = globalAtom<IRouteInfo>({
  persist: false,
  name: EAtomNames.routeAtom,
  initialValue: {
    currentTab: 'home',
  },
});
