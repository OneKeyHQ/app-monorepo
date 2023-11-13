import {
  atom,
  createJotaiContext,
} from '../../../store/jotai/createJotaiContext';

import { homeTab } from './contextWebTabs';

export const {
  withProvider: withProviderBrowserHistory,
  useContextAtom: useAtomBrowserHistory,
} = createJotaiContext();

interface IBrowserHistory {
  title: string;
  url: string;
}

export const browserHistoryAtom = atom<IBrowserHistory[]>([]);

export const addBrowserHistoryAtom = atom(
  null,
  (get, set, payload: IBrowserHistory) => {
    if (!payload.url || payload.url === homeTab.url) {
      return;
    }
    const history = get(browserHistoryAtom);
    const index = history.findIndex((item) => item.url === payload.url);
    if (index !== -1) {
      history.splice(index, 1);
    }
    history.unshift({ url: payload.url, title: payload.title });
    set(browserHistoryAtom, history);
    console.log('===>set browserHistoryAtom: ', history);
  },
);

export const removeBrowserHistoryAtom = atom(
  null,
  (get, set, payload: string) => {
    const history = get(browserHistoryAtom);
    const index = history.findIndex((item) => item.url === payload);
    if (index !== -1) {
      history.splice(index, 1);
    }
    set(browserHistoryAtom, history);
  },
);
