import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { ENotificationPushTopicTypes } from '@onekeyhq/shared/types/notification';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  private readonly startupAttemptId = generateUUID();

  @LogToServer()
  @LogToLocal()
  public pageView(pageName: string) {
    setTimeout(() => {
      void import('@onekeyhq/shared/src/modules3rdParty/sentry').then(
        ({ addBreadcrumb }) => {
          addBreadcrumb({
            category: 'page',
            message: pageName,
            level: 'info',
          });
        },
      );
    });
    return { pageName };
  }

  @LogToServer()
  @LogToLocal()
  public appStart() {
    // Correlates appStart with jsReadyTime/uiVisibleTime of the same launch,
    // so launches that never became visible can be counted.
    return { startupAttemptId: this.startupAttemptId };
  }

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
      startupAttemptId: this.startupAttemptId,
    };
  }

  @LogToServer()
  @LogToLocal()
  public uiVisibleTime(duration: number) {
    return {
      duration,
      startupAttemptId: this.startupAttemptId,
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
