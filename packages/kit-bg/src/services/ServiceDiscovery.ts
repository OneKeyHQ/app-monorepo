import { isEqual } from 'lodash';

import type {
  IWebTab,
  IWebTabsAtom,
} from '@onekeyhq/kit/src/views/Discovery/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

function buildWebTabData(tabs: IWebTab[]) {
  const map: Record<string, IWebTab> = {};
  const keys: string[] = [];
  tabs.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return 0;
  });
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

@backgroundClass()
class ServiceDiscovery extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /**
   * Logic for managing browser tab states
   */
  @backgroundMethod()
  public async setWebTabs(
    previousWebTabs: IWebTabsAtom,
    payload: { data: IWebTab[]; options?: { forceUpdate?: boolean } },
  ): Promise<{
    data: IWebTab[];
    keys: string[];
    map: Record<string, IWebTab>;
    shouldUpdateTabs: boolean;
  }> {
    const { data, options } = payload;
    let newTabs = data;
    if (!Array.isArray(payload.data)) {
      throw new Error('setWebTabsWriteAtom: payload must be an array');
    }
    if (!newTabs || !newTabs.length) {
      newTabs = [];
    }
    const result = buildWebTabData(newTabs);
    let shouldUpdateTabs = false;
    if (!isEqual(result.keys, previousWebTabs.keys) || options?.forceUpdate) {
      shouldUpdateTabs = true;
    }
    return Promise.resolve({
      shouldUpdateTabs,
      keys: result.keys,
      data: result.data,
      map: result.map,
    });
  }

  @backgroundMethod()
  public async setWebTabData(
    previousTabs: IWebTab[],
    payload: Partial<IWebTab>,
  ): Promise<{
    tabs: IWebTab[];
    resetFlag: Record<string, number> | null;
  }> {
    const tabs = previousTabs;
    let resetFlag: Record<string, number> | null = null;
    const tabIndex = tabs.findIndex((t) => t.id === payload.id);
    if (tabIndex > -1) {
      const tabToModify = tabs[tabIndex];
      Object.keys(payload).forEach((k) => {
        const key = k as keyof IWebTab;
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
            if (value === 'about:blank' && payload.id) {
              resetFlag = {};
              resetFlag[payload.id] = tabToModify.timestamp;
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
      tabs[tabIndex] = tabToModify;
    }
    return {
      resetFlag,
      tabs,
    };
  }

  @backgroundMethod()
  public async closeWebTab(
    tabs: IWebTab[],
    activeTabId: string | null,
    tabId: string,
  ) {
    let newActiveTabId = null;
    const targetIndex = tabs.findIndex((t) => t.id === tabId);
    if (targetIndex !== -1) {
      if (tabs[targetIndex].id === activeTabId) {
        const prev = tabs[targetIndex - 1];
        if (prev) {
          prev.isActive = true;
          newActiveTabId = prev.id;
        }
      }
      tabs.splice(targetIndex, 1);
    }
    return Promise.resolve({
      tabs,
      newActiveTabId,
    });
  }

  @backgroundMethod()
  public async closeAllWebTabsAtom(
    tabs: IWebTab[],
    activeTabId: string | null,
  ) {
    let newActiveTabId = null;
    const pinnedTabs = tabs.filter((tab) => tab.isPinned); // close all tabs exclude pinned tab
    // should update active tab, if active tab is not in pinnedTabs
    if (pinnedTabs.every((tab) => tab.id !== activeTabId)) {
      if (pinnedTabs.length) {
        pinnedTabs[pinnedTabs.length - 1].isActive = true;
        newActiveTabId = pinnedTabs[pinnedTabs.length - 1].id;
      }
    }
    return Promise.resolve({
      pinnedTabs,
      newActiveTabId,
    });
  }
}

export default ServiceDiscovery;
