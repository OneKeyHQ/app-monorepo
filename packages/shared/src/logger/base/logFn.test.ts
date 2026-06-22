import appGlobals from '../../appGlobals';
import { loggerConfig } from '../loggerConfig';
import { captureLoggerUtmParamsFromUrl } from '../utmParams';

import { BaseScene } from './baseScene';
import { LogToServer } from './decorators';

import type { Analytics } from '../../analytics';

class ServerLogScene extends BaseScene {
  @LogToServer()
  utmParamsCaptured(params: Record<string, string>) {
    return params;
  }

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

  it('reports utm params through a dedicated event only', () => {
    const captured = captureLoggerUtmParamsFromUrl(
      'https://app.onekey.so/perps?utm_source=dedicated',
    );
    expect(captured?.params).toEqual({ utm_source: 'dedicated' });

    const scene = new ServerLogScene();
    scene.campaignEvent({ value: 'event' });
    scene.utmParamsCaptured(captured?.params ?? {});

    captureLoggerUtmParamsFromUrl(
      'https://app.onekey.so/perps?utm_source=later',
    );
    jest.runOnlyPendingTimers();

    expect(trackEvent).toHaveBeenCalledWith('campaignEvent', {
      value: 'event',
    });
    expect(trackEvent).toHaveBeenCalledWith('utmParamsCaptured', {
      utm_source: 'dedicated',
    });
  });
});
