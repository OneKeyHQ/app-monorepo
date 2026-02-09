import { addBreadcrumb } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import type { ENotificationPushTopicTypes } from '@onekeyhq/shared/types/notification';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public pageView(pageName: string) {
    setTimeout(() => {
      addBreadcrumb({
        category: 'page',
        message: pageName,
        level: 'info',
      });
    });
    return { pageName };
  }

  @LogToServer()
  @LogToLocal()
  public appStart() {}

  @LogToServer()
  @LogToLocal()
  public navigationToggle() {}

  @LogToServer()
  @LogToLocal()
  public tabBarClick(tabName: string) {
    return { tabName };
  }

  @LogToServer()
  @LogToLocal()
  public notificationItemClicked(
    notificationId: string,
    type: ENotificationPushTopicTypes | 'unknown',
    clickFrom: 'app' | 'system',
  ) {
    return { notificationId, type, clickFrom };
  }

  @LogToServer()
  @LogToLocal()
  public testWebEmbed() {
    return { test: 'test' };
  }

  @LogToServer()
  @LogToLocal()
  public jsReadyTime(duration: number) {
    return {
      duration,
    };
  }

  @LogToServer()
  @LogToLocal()
  public uiVisibleTime(duration: number) {
    return {
      duration,
    };
  }

  @LogToLocal()
  public dispatchUnlockJob() {
    return {};
  }

  @LogToLocal()
  public isAppLocked(isLock: boolean) {
    return { isLock };
  }

  @LogToLocal()
  public addUnlockJob() {
    return {};
  }

  @LogToLocal()
  public removeUnlockJob() {
    return {};
  }

  @LogToLocal()
  public getDualScreenInfoWidth(params: {
    windowWidth: number;
    screenWidth: number;
    isDualScreen: boolean;
    isSpanning: boolean;
    isRawSpanning: boolean;
    result: number;
  }) {
    return params;
  }

  @LogToLocal()
  public homePageViewTabContainerWidth(params: {
    tabContainerWidth: number | string | undefined;
    isNative: boolean;
    widthPassedToTabs: number | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public useTabContainerWidth(params: {
    isDualScreen: boolean;
    isTablet: boolean;
    isLandscape: boolean;
    windowWidth: number;
    isIpadModalPage: boolean;
    ipadModalPageWidth: number | undefined;
    dualScreenWidth: number | undefined;
    result: number;
  }) {
    return params;
  }
}
