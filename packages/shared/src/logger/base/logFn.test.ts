import appGlobals from '../../appGlobals';
import platformEnv from '../../platformEnv';
import { loggerConfig } from '../loggerConfig';
import { KeylessScene } from '../scopes/wallet/scenes/keyless';
import loggerUtils from '../utils';
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

  @LogToServer({ level: 'info', waitForServer: true })
  private confirmedEvent(params: Record<string, string>) {
    return params;
  }

  confirmedEventDelivery(params: Record<string, string>): Promise<void> {
    return this.confirmedEvent(params) as unknown as Promise<void>;
  }
}

describe('logFn', () => {
  let trackEvent: jest.MockedFunction<Analytics['trackEvent']>;
  let trackEventAsync: jest.MockedFunction<Analytics['trackEventAsync']>;

  beforeEach(() => {
    jest.useFakeTimers();
    trackEvent = jest.fn();
    trackEventAsync = jest.fn().mockResolvedValue(undefined);
    appGlobals.$analytics = {
      trackEvent,
      trackEventAsync,
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

  it('writes Keyless receipt diagnostics locally in production without raw fields', () => {
    const prevEnv = process.env.NODE_ENV;
    const dev = jest.replaceProperty(platformEnv, 'isDev', false);
    const persist = jest
      .spyOn(loggerUtils, 'consoleFunc')
      .mockImplementation(() => {});
    try {
      process.env.NODE_ENV = 'production';
      const scene = new KeylessScene();
      scene.scopeName = 'wallet';
      scene.sceneName = 'keyless';
      const fields = {
        status: 'revisionInvalid' as const,
        baseRevision: 3,
        revision: Number.NaN,
        responseCode: 0,
        hashIdMatches: true,
        requestId: 'synthetic-not-a-request-id',
        hashId: 'synthetic-private-field',
      };
      scene.backendShareUploadReceipt(fields);
      jest.runOnlyPendingTimers();
      expect(persist).toHaveBeenCalledTimes(1);
      const [message] = persist.mock.calls[0];
      expect(message).toContain(
        'INFO : wallet => keyless => backendShareUploadReceipt',
      );
      expect(message).toContain('"baseRevision":3');
      expect(message).toContain('"hashIdMatches":true');
      expect(message).not.toContain('synthetic-');
      expect(message).not.toContain('"revision":');
      expect(trackEvent).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prevEnv;
      dev.restore();
      persist.mockRestore();
    }
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

  it('waits for confirmed server delivery when requested', async () => {
    const scene = new ServerLogScene();
    const delivery = scene.confirmedEventDelivery({
      utm_source: 'confirmed',
    });

    jest.runOnlyPendingTimers();

    await expect(delivery).resolves.toBeUndefined();
    expect(trackEventAsync).toHaveBeenCalledWith('confirmedEvent', {
      utm_source: 'confirmed',
    });
  });

  it('propagates confirmed server delivery failures', async () => {
    trackEventAsync.mockRejectedValueOnce(new Error('network failed'));
    const scene = new ServerLogScene();
    const delivery = scene.confirmedEventDelivery({
      utm_source: 'retry',
    });

    jest.runOnlyPendingTimers();

    await expect(delivery).rejects.toThrow('network failed');
  });
});
