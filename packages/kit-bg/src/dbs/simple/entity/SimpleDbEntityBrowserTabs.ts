import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBrowserTabs {
  tabs: IWebTab[];
}

type IBrowserTabsDataOrBuilder =
  | IBrowserTabs
  | ((rawData: IBrowserTabs | null | undefined) => IBrowserTabs)
  | ((rawData: IBrowserTabs | null | undefined) => Promise<IBrowserTabs>);

function getTabsCount(data: IBrowserTabs | null | undefined) {
  return Array.isArray(data?.tabs) ? data.tabs.length : undefined;
}

function isNotNil<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function getLogErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

export class SimpleDbEntityBrowserTabs extends SimpleDbEntityBase<IBrowserTabs> {
  entityName = 'browserTabs';

  override enableCache = true;

  @backgroundMethod()
  override async getRawData() {
    defaultLogger.discovery.browser.browserTabsLifecycle({
      step: 'simpleDbBrowserTabsGetRawDataStart',
      source: 'SimpleDbEntityBrowserTabs',
      hasCache: this.enableCache && isNotNil(this.cachedRawData),
      tabsCount: getTabsCount(this.cachedRawData),
      updatedAt: this.updatedAt,
    });
    try {
      const data = await super.getRawData();
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'simpleDbBrowserTabsGetRawDataSuccess',
        source: 'SimpleDbEntityBrowserTabs',
        hasCache: this.enableCache && isNotNil(this.cachedRawData),
        tabsCount: getTabsCount(data),
        isDataNullish: !isNotNil(data),
        updatedAt: this.updatedAt,
      });
      return data;
    } catch (error) {
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'simpleDbBrowserTabsGetRawDataError',
        source: 'SimpleDbEntityBrowserTabs',
        result: 'error',
        hasCache: this.enableCache && isNotNil(this.cachedRawData),
        tabsCount: getTabsCount(this.cachedRawData),
        updatedAt: this.updatedAt,
        errorName: getLogErrorName(error),
      });
      throw error;
    }
  }

  @backgroundMethod()
  override async setRawData(dataOrBuilder: IBrowserTabsDataOrBuilder) {
    const isBuilderPayload = typeof dataOrBuilder === 'function';
    defaultLogger.discovery.browser.browserTabsLifecycle({
      step: 'simpleDbBrowserTabsSetRawDataStart',
      source: 'SimpleDbEntityBrowserTabs',
      tabsCount: isBuilderPayload ? undefined : getTabsCount(dataOrBuilder),
      isBuilderPayload,
      hasCache: this.enableCache && isNotNil(this.cachedRawData),
      updatedAt: this.updatedAt,
    });
    try {
      const data = await super.setRawData(dataOrBuilder);
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'simpleDbBrowserTabsSetRawDataSuccess',
        source: 'SimpleDbEntityBrowserTabs',
        tabsCount: getTabsCount(data),
        isBuilderPayload,
        hasCache: this.enableCache && isNotNil(this.cachedRawData),
        updatedAt: this.updatedAt,
      });
      return data;
    } catch (error) {
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'simpleDbBrowserTabsSetRawDataError',
        source: 'SimpleDbEntityBrowserTabs',
        result: 'error',
        tabsCount: isBuilderPayload ? undefined : getTabsCount(dataOrBuilder),
        isBuilderPayload,
        hasCache: this.enableCache && isNotNil(this.cachedRawData),
        updatedAt: this.updatedAt,
        errorName: getLogErrorName(error),
      });
      throw error;
    }
  }

  @backgroundMethod()
  override async clearRawData() {
    defaultLogger.discovery.browser.browserTabsLifecycle({
      step: 'simpleDbBrowserTabsClearRawDataStart',
      source: 'SimpleDbEntityBrowserTabs',
      hasCache: this.enableCache && isNotNil(this.cachedRawData),
      tabsCount: getTabsCount(this.cachedRawData),
      updatedAt: this.updatedAt,
    });
    try {
      const result = await super.clearRawData();
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'simpleDbBrowserTabsClearRawDataSuccess',
        source: 'SimpleDbEntityBrowserTabs',
        updatedAt: this.updatedAt,
        result: 'success',
      });
      return result;
    } catch (error) {
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'simpleDbBrowserTabsClearRawDataError',
        source: 'SimpleDbEntityBrowserTabs',
        result: 'error',
        hasCache: this.enableCache && isNotNil(this.cachedRawData),
        tabsCount: getTabsCount(this.cachedRawData),
        updatedAt: this.updatedAt,
        errorName: getLogErrorName(error),
      });
      throw error;
    }
  }
}
