/* eslint-disable max-classes-per-file */
import { isEqual } from 'lodash';
// import { nanoid } from 'nanoid';

import { simpleDb } from '@onekeyhq/kit/src/components/WebView/mock';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  ContextJotaiActionsBase,
  createJotaiContext,
} from '../../../../store/jotai';
import { validateUrl, webHandler, webviewRefs } from '../../explorerUtils';

import type {
  IOnWebviewNavigationParams,
  MatchDAppItemType,
} from '../../explorerUtils';
import type { WebSiteHistory } from '../../types';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { WebView } from 'react-native-webview';

export interface WebTab {
  id: string;
  url: string;
  title?: string;
  favicon?: string;
  thumbnail?: string;
  isCurrent: boolean;
  isBookmarked?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  refReady?: boolean;
  timestamp?: number;
}

export const homeTab: WebTab = {
  id: 'home',
  // current url in webview
  url: 'about:blank',
  title: 'OneKey',
  isCurrent: true,
  canGoBack: false,
  loading: false,
  favicon: '',
};

export const homeResettingFlags: Record<string, number> = {};
// eslint-disable-next-line @typescript-eslint/naming-convention
let _currentTabId = '';

export function buildWebTabData(tabs: WebTab[]) {
  const map: Record<string, WebTab> = {};
  const keys: string[] = [];
  tabs.forEach((tab) => {
    keys.push(tab.id);
    map[tab.id] = tab;
  });
  return {
    data: tabs,
    keys,
    map,
  };
}

const {
  withProvider: withProviderWebTabs,
  contextAtomMethod,
  contextAtom,
  contextAtomComputed,
} = createJotaiContext();

interface IWebTabsAtom {
  tabs: WebTab[];
  keys: string[];
}

export const { atom: webTabsAtom, use: useWebTabsAtom } =
  contextAtom<IWebTabsAtom>({ tabs: [], keys: [] });

export const { atom: webTabsMapAtom, use: useWebTabsMapAtom } = contextAtom<
  Record<string, WebTab>
>({
  [homeTab.id]: homeTab,
});

export const { atom: incomingUrlAtom, use: useIncomingUrlAtom } =
  contextAtom<string>('');

// TODO standalone primitive atom
export const { atom: currentTabIdAtom, use: useCurrentTabIdAtom } =
  contextAtomComputed(
    (get) => get(webTabsAtom()).tabs.find((t) => t.isCurrent)?.id || '',
  );

function getWebTabsInfo({
  id,
  data,
  map,
  currentTabId,
}: {
  id?: string;
  data: IWebTabsAtom;
  map: Record<string, WebTab>;
  currentTabId: string;
}) {
  const { tabs } = data;
  const curId = id || currentTabId;
  return {
    tabs, // TODO remove
    tab: map[curId || ''] ?? tabs[0],
    currentTabId,
  };
}

export function useWebTabsInfo(id?: string) {
  const [data] = useWebTabsAtom();
  const [map] = useWebTabsMapAtom();
  const [currentTabId] = useCurrentTabIdAtom();
  return getWebTabsInfo({ id, map, data, currentTabId });
}

class ContextJotaiActionsWebTabs extends ContextJotaiActionsBase {
  getWebTabsInfo = contextAtomMethod((get, set, id?: string) => {
    const data = get(webTabsAtom());
    const map = get(webTabsMapAtom());
    const currentTabId = get(currentTabIdAtom());
    return getWebTabsInfo({
      id,
      data,
      map,
      currentTabId,
    });
  });

  addBlankWebTab = contextAtomMethod((_, set) => {
    this.addWebTab.call(set, { ...homeTab });
  });

  addWebTab = contextAtomMethod((get, set, payload: Partial<WebTab>) => {
    const { tabs } = get(webTabsAtom());
    // TODO: Add limit for native

    if (!payload.id || payload.id === homeTab.id) {
      // TODO: nanoid will crash on native
      // payload.id = nanoid();
      // tabs.length + random(10 - 100)
      payload.id = `${
        tabs.length + Math.floor(Math.random() * (100 - 10 + 1)) + 10
      }`;
    }
    if (payload.isCurrent) {
      for (const tab of tabs) {
        tab.isCurrent = false;
      }
      _currentTabId = payload.id;
    }
    payload.timestamp = Date.now();
    this.setWebTabs.call(set, [...tabs, payload as WebTab]);
  });

  setWebTabs = contextAtomMethod((get, set, payload: WebTab[]) => {
    let newTabs = payload;
    if (!Array.isArray(payload)) {
      throw new Error('setWebTabsWriteAtom: payload must be an array');
    }
    if (!newTabs || !newTabs.length) {
      newTabs = [{ ...homeTab }];
    }
    const result = buildWebTabData(newTabs);
    if (!isEqual(result.keys, get(webTabsAtom()).keys)) {
      set(webTabsAtom(), { keys: result.keys, tabs: result.data });
    }

    set(webTabsMapAtom(), () => result.map);
    simpleDb.discoverWebTabs.setRawData({
      tabs: newTabs,
    });
  });

  closeWebTab = contextAtomMethod((get, set, tabId: string) => {
    delete webviewRefs[tabId];
    const { tabs } = get(webTabsAtom());
    const targetIndex = tabs.findIndex((t) => t.id === tabId);
    if (targetIndex !== -1) {
      if (tabs[targetIndex].isCurrent) {
        const prev = tabs[targetIndex - 1];
        if (prev) {
          prev.isCurrent = true;
          _currentTabId = prev.id;
        }
      }
      tabs.splice(targetIndex, 1);
      this.setWebTabs.call(set, [...tabs]);
    }
  });

  setWebTabData = contextAtomMethod((get, set, payload: Partial<WebTab>) => {
    const { tabs } = get(webTabsAtom());
    const tabIndex = tabs.findIndex((t) => t.id === payload.id);
    // console.log('setWebTabDataAtomWithWriteOnly: payload: => : ', payload);
    if (tabIndex > -1) {
      const tabToModify = tabs[tabIndex];
      Object.keys(payload).forEach((k) => {
        const key = k as keyof WebTab;
        const value = payload[key];
        if (value !== undefined && value !== tabToModify[key]) {
          if (key === 'title') {
            if (!value) {
              return;
            }
          }
          // @ts-expect-error
          tabToModify[key] = value;
          if (key === 'url') {
            tabToModify.timestamp = Date.now();
            if (value === homeTab.url && payload.id) {
              homeResettingFlags[payload.id] = tabToModify.timestamp;
            }
            if (!payload.favicon) {
              try {
                tabToModify.favicon = `${
                  new URL(tabToModify.url ?? '').origin
                }/favicon.ico`;
              } catch {
                // ignore
              }
            }
          }
        }
      });
      // if the tab is home tab, update the title
      if (
        tabToModify.url === homeTab.url &&
        (!tabToModify.title || tabToModify.title !== homeTab.title)
      ) {
        tabToModify.title = homeTab.title;
      }
      tabs[tabIndex] = tabToModify;
      this.setWebTabs.call(set, tabs);
    }
  });

  closeAllWebTabs = contextAtomMethod((_, set) => {
    for (const id of Object.getOwnPropertyNames(webviewRefs)) {
      delete webviewRefs[id];
    }
    this.setWebTabs.call(set, [{ ...homeTab }]);
    _currentTabId = homeTab.id;
  });

  setCurrentWebTab = contextAtomMethod((get, set, tabId: string) => {
    if (platformEnv.isNative) {
      this.dismissWebviewKeyboard.call(set);
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const currentTabId = get(currentTabIdAtom());
    if (currentTabId !== tabId) {
      // pauseDappInteraction(currentTabId);
      const { tabs } = get(webTabsAtom());
      let previousTabUpdated = false;
      let nextTabUpdated = false;

      for (let i = 0; i < tabs.length; i += 1) {
        const tab = tabs[i];
        if (tab.isCurrent) {
          tabs[i] = {
            ...tab,
            isCurrent: false,
          };
          previousTabUpdated = true;
        } else if (tab.id === tabId) {
          tabs[i] = {
            ...tab,
            isCurrent: true,
          };
          nextTabUpdated = true;
        }
        if (previousTabUpdated && nextTabUpdated) {
          break;
        }
      }
      this.setWebTabs.call(set, tabs);
      // resumeDappInteraction(tabId);
      _currentTabId = tabId;
    }
  });

  goToSite = contextAtomMethod(
    (
      get,
      set,
      payload: WebSiteHistory & {
        dAppId?: string;
        isNewWindow?: boolean;
        isInPlace?: boolean;
        id?: string;
        userTriggered?: boolean;
      },
    ) => {
      const { url, title, favicon, isNewWindow, isInPlace, id, userTriggered } =
        payload;

      const { tab } = this.getWebTabsInfo.call(set, id);
      if (url && tab) {
        const validatedUrl = validateUrl(url);
        if (!validatedUrl) {
          return;
        }

        if (userTriggered) {
          // TODO: add to history
        }

        // if (webHandler === 'browser') {
        //   return openUrl(validatedUrl);
        // }

        const tabId = tab.id;
        const isDeepLink =
          !validatedUrl.startsWith('http') && validatedUrl !== 'about:blank';
        const isNewTab =
          (isNewWindow || tabId === 'home' || isDeepLink) &&
          webHandler === 'tabbedWebview';

        // const urls = bookmarks?.map((item) => item.url);
        // const isBookmarked = urls?.includes(url);

        if (isNewTab) {
          this.addWebTab.call(set, {
            title,
            url: validatedUrl,
            favicon,
            isCurrent: true,
            isBookmarked: false,
          });
        } else {
          this.setWebTabData.call(set, {
            id: tabId,
            url: validatedUrl,
            title,
            favicon,
            isBookmarked: false,
          });
        }

        if (!isNewTab && !isInPlace) {
          this.crossWebviewLoadUrl.call(set, {
            url: validatedUrl,
            tabId,
          });
        }

        // close deep link tab after 1s
        if (isDeepLink) {
          if (webHandler === 'tabbedWebview') {
            setTimeout(() => {
              this.closeWebTab.call(set, tabId);
            }, 1000);
          }
        }
        return true;
      }
      return false;
    },
  );

  openMatchDApp = contextAtomMethod((get, set, payload: MatchDAppItemType) => {
    const { dapp, webSite, isNewWindow } = payload;

    if (webSite) {
      return this.goToSite.call(set, {
        url: webSite.url,
        title: webSite.title,
        favicon: webSite.favicon,
        isNewWindow,
        userTriggered: true,
      });
    }
    if (dapp) {
      return this.goToSite.call(set, {
        url: dapp.url,
        title: dapp.name,
        dAppId: dapp._id,
        favicon: dapp.logoURL,
        userTriggered: true,
        isNewWindow,
      });
    }
  });

  handleWebviewNavigation = contextAtomMethod(
    (get, set, payload: IOnWebviewNavigationParams) => {
      const {
        url,
        isNewWindow,
        isInPlace,
        title,
        favicon,
        canGoBack,
        canGoForward,
        loading,
        id,
      } = payload;
      const now = Date.now();
      const { tab: curTab } = this.getWebTabsInfo.call(set, id);
      if (!curTab) {
        return;
      }
      const curId = curTab.id;
      const isValidNewUrl = typeof url === 'string' && url !== curTab.url;
      if (isValidNewUrl) {
        if (curTab.timestamp && now - curTab.timestamp < 500) {
          // ignore url change if it's too fast to avoid back & forth loop
          return;
        }
        if (
          homeResettingFlags[curId] &&
          url !== homeTab.url &&
          now - homeResettingFlags[curId] < 1000
        ) {
          return;
        }
        this.goToSite.call(set, {
          url,
          title,
          favicon,
          isNewWindow,
          isInPlace,
          id: curId,
        });
      }
      this.setWebTabData.call(set, {
        id: curId,
        title,
        favicon,
        canGoBack,
        canGoForward,
        loading,
      });
    },
  );

  getWebviewWrapperRef = contextAtomMethod((get, _, id?: string) => {
    let tabId = id;
    if (!tabId) {
      tabId = get(currentTabIdAtom());
    }
    const refs = webviewRefs;
    const ref = tabId ? refs[tabId] : null;
    return ref ?? null;
  });

  crossWebviewLoadUrl = contextAtomMethod(
    (
      get,
      set,
      payload: {
        url: string;
        tabId?: string;
      },
    ) => {
      const { url, tabId } = payload;
      const wrapperRef = this.getWebviewWrapperRef.call(set, tabId);
      // debugLogger.webview.info('crossWebviewLoadUrl >>>>', url);
      console.log('crossWebviewLoadUrl >>>>', url);
      if (platformEnv.isDesktop) {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (wrapperRef?.innerRef as IElectronWebView)?.loadURL(url).catch();
      } else if (platformEnv.isRuntimeBrowser) {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (wrapperRef?.innerRef as IElectronWebView)?.loadURL(url);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (wrapperRef?.innerRef as WebView)?.loadUrl(url);
      }
    },
  );

  dismissWebviewKeyboard = contextAtomMethod((get, set, id?: string) => {
    // for hide keyboard
    const injectToDismissWebviewKeyboard = `
(function(){
  document.activeElement && document.activeElement.blur()
})()
`;
    const ref = this.getWebviewWrapperRef.call(set, id);
    if (ref) {
      if (platformEnv.isNative) {
        try {
          (ref.innerRef as WebView)?.injectJavaScript(
            injectToDismissWebviewKeyboard,
          );
        } catch (error) {
          // ipad mini orientation changed cause injectJavaScript ERROR, which crash app
          console.error(
            'blurActiveElement webview.injectJavaScript() ERROR >>>>> ',
            error,
          );
        }
      }
      if (platformEnv.isDesktop) {
        const deskTopRef = ref.innerRef as IElectronWebView;
        if (deskTopRef) {
          try {
            deskTopRef.executeJavaScript(injectToDismissWebviewKeyboard);
          } catch (e) {
            // if not dom ready, no need to pause websocket
          }
        }
      }
    }
  });
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsWebTabs()', Date.now());
  return new ContextJotaiActionsWebTabs();
});

// const actions1 = createActions();
// const actions2 = createActions();
// const actions3 = createActions();
// const actions4 = createActions();

export function useWebTabsActions() {
  const actions = createActions();
  const actions1 = createActions();
  const actions2 = createActions();
  const addBlankWebTab = actions.addBlankWebTab.use();
  const addWebTab = actions.addWebTab.use();
  const setWebTabs = actions.setWebTabs.use();
  const closeWebTab = actions.closeWebTab.use();
  const setWebTabData = actions.setWebTabData.use();
  const closeAllWebTabs = actions.closeAllWebTabs.use();
  const setCurrentWebTab = actions.setCurrentWebTab.use();
  const goToSite = actions.goToSite.use();
  const openMatchDApp = actions.openMatchDApp.use();
  const handleWebviewNavigation = actions.handleWebviewNavigation.use();
  const getWebviewWrapperRef = actions.getWebviewWrapperRef.use();
  const crossWebviewLoadUrl = actions.crossWebviewLoadUrl.use();
  const dismissWebviewKeyboard = actions.dismissWebviewKeyboard.use();

  return {
    addBlankWebTab,
    addWebTab,
    setWebTabs,
    closeWebTab,
    setWebTabData,
    closeAllWebTabs,
    setCurrentWebTab,
    goToSite,
    openMatchDApp,
    handleWebviewNavigation,
    getWebviewWrapperRef,
    crossWebviewLoadUrl,
    dismissWebviewKeyboard,
  };
}

export { withProviderWebTabs };
