import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ENotificationPushTopicTypes } from '@onekeyhq/shared/types/notification';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public pageView(pageName: string) {
    return { pageName };
  }

  @LogToServer()
  @LogToLocal()
  public appStart() {}

  @LogToLocal()
  public jsVersion(params: {
    appVersion: string;
    buildNumber: string;
    bundleVersion: string;
    githubSHA: string;
  }) {
    return params;
  }

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
  public openExternalUrl(params: { host: string; method: 'inApp' | 'system' }) {
    return params;
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
}
