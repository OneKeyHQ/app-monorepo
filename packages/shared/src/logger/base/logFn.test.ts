import appGlobals from '../../appGlobals';
import { loggerConfig } from '../loggerConfig';
import { captureLoggerUtmParamsFromUrl } from '../utmParams';

import { BaseScene } from './baseScene';
import { LogToServer } from './decorators';

import type { Analytics } from '../../analytics';

class ServerLogScene extends BaseScene {
  @LogToServer()
  campaignEvent(params: Record<string, string>) {
    return params;
  }
}

describe('logFn', () => {
  let trackEvent: jest.MockedFunction<Analytics['trackEvent']>;

  beforeEach(() => {
    jest.useFakeTimers();
    trackEvent = jest.fn();
    appGlobals.$analytics = {
      trackEvent,
    } as unknown as Analytics;
    loggerConfig.updateRuntimeConfig({
      enabled: {},
      colorfulLog: false,
      highlightDurationGt: '100',
    });
  });

  afterEach(() => {
    appGlobals.$analytics = undefined;
    jest.useRealTimers();
  });

  it('uses the utm snapshot captured when the log entry is emitted', () => {
    captureLoggerUtmParamsFromUrl(
      'https://app.onekey.so/perps?utm_source=before',
    );

    const scene = new ServerLogScene();
    scene.campaignEvent({ value: 'event' });

    captureLoggerUtmParamsFromUrl(
      'https://app.onekey.so/perps?utm_source=later',
    );
    jest.runOnlyPendingTimers();

    expect(trackEvent).toHaveBeenCalledWith('campaignEvent', {
      utm_source: 'before',
      value: 'event',
    });
  });
});
