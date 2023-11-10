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
    payload: IWebTab[],
  ): Promise<{
    data: IWebTab[];
    keys: string[];
    map: Record<string, IWebTab>;
    shouldUpdateTabs: boolean;
  }> {
    let newTabs = payload;
    if (!Array.isArray(payload)) {
      throw new Error('setWebTabsWriteAtom: payload must be an array');
    }
    if (!newTabs || !newTabs.length) {
      newTabs = [];
    }
    const result = buildWebTabData(newTabs);
    let shouldUpdateTabs = false;
    if (!isEqual(result.keys, previousWebTabs.keys)) {
      console.log(
        'setWebTabsAtom: payload: ',
        payload,
        ' keys: ',
        result.keys,
        ' data: ',
        result.data,
      );
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
}

export default ServiceDiscovery;
