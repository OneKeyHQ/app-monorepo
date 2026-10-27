/* eslint-disable max-classes-per-file */
// cspell:ignore rrweb sesid rageclick pageleave
import type { IReplayControllerExtensions } from './replayGate';
import type {
  IInitSessionReplayOptions,
  IReplayController,
  IReplayControllerRegistration,
  IReplayGateStatus,
} from './replayTypes';
import type {
  BeforeSendFn,
  CaptureResult,
  CapturedNetworkRequest,
  PostHogConfig,
} from 'posthog-js';

type IDesktopController = IReplayController & IReplayControllerExtensions;
type ISessionHandler = (
  sessionId: string,
  windowId: string,
  changeReason?: { noSessionId: boolean; activityTimeout: boolean },
) => void;

// Bucket 0 (sampled at 300) and bucket 8559 (not sampled at 300).
const SAMPLED_SID = '01890a5d-ac96-774b-bcce-000000000000';
const UNSAMPLED_SID = '01890a5d-ac96-774b-bcce-0000deadbeef';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const NOW = 1_700_000_000_000;

const mockPlatformEnv = { isDesktop: true, isDev: false, isE2E: false };
const mockProjectConfig: { token: string | undefined; host: string } = {
  token: 'phc_test_token',
  host: 'https://eu.i.posthog.com',
};
const mockRegister = jest.fn<void, [IReplayControllerRegistration]>();
const mockUnregister = jest.fn<void, []>();
const mockNotifyActivity = jest.fn<void, []>();
const mockRecorderLoaded = jest.fn<void, []>();
const mockStatusListeners: ((status: IReplayGateStatus) => void)[] = [];
const mockGate: { status: IReplayGateStatus } = {
  status: {
    hasController: true,
    sampled: true,
    forced: false,
    recording: false,
    pauseReasons: [],
  },
};

class MockSessionManager {
  sessionTimeoutMs = SESSION_TIMEOUT_MS;

  handlers: ISessionHandler[] = [];

  nextIds: string[] = [];

  constructor(private readonly owner: MockPostHog) {}

  onSessionId(handler: ISessionHandler) {
    this.handlers.push(handler);
    return () => undefined;
  }

  checkAndGetSessionAndWindowId(readOnly = false) {
    const now = Date.now();
    const persisted = this.owner.props.$sesid as
      | [number, string | null, number]
      | undefined;
    const [lastActivity, current, startedAt] = persisted ?? [0, null, 0];
    const rotate =
      !current ||
      (!readOnly && now - lastActivity > this.sessionTimeoutMs) ||
      now - startedAt > 24 * 60 * 60 * 1000;
    if (rotate) {
      const next = this.nextIds.shift() ?? SAMPLED_SID;
      const changeReason = {
        noSessionId: !current,
        activityTimeout: !!current,
      };
      this.owner.props.$sesid = [now, next, now];
      this.handlers.forEach((handler) => handler(next, 'window', changeReason));
      return { sessionId: next, windowId: 'window', changeReason };
    }
    this.owner.props.$sesid = [
      readOnly ? lastActivity : now,
      current,
      startedAt,
    ];
    return { sessionId: current, windowId: 'window', changeReason: undefined };
  }
}

class MockPostHog {
  static instances: MockPostHog[] = [];

  props: Record<string, unknown> = {};

  token: string | undefined;

  config: Partial<PostHogConfig> | undefined;

  sessionManager: MockSessionManager | undefined;

  recording = false;

  calls: string[] = [];

  constructor() {
    MockPostHog.instances.push(this);
  }

  init(token: string, config: Partial<PostHogConfig>) {
    this.token = token;
    this.config = config;
    this.sessionManager = new MockSessionManager(this);
    return this;
  }

  get_property(name: string): unknown {
    return this.props[name];
  }

  startSessionRecording(...args: unknown[]) {
    this.calls.push(args.length ? 'start:override' : 'start');
    this.recording = true;
  }

  stopSessionRecording() {
    this.calls.push('stop');
    this.recording = false;
  }

  sessionRecordingStarted() {
    return this.recording;
  }
}

jest.mock('posthog-js', () => ({ PostHog: MockPostHog }));
jest.mock('posthog-js/dist/posthog-recorder', () => {
  mockRecorderLoaded();
  return {};
});
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));
jest.mock('./replayConfig', () => ({
  REPLAY_SAMPLE_THRESHOLDS: { ios: 300, android: 300, desktop: 300 },
  getReplayProjectConfig: () => mockProjectConfig,
}));
jest.mock('./replayGate', () => ({
  registerReplayController: (reg: IReplayControllerRegistration) =>
    mockRegister(reg),
  unregisterReplayController: () => mockUnregister(),
  notifyReplayActivity: () => mockNotifyActivity(),
  getReplayGateStatus: () => mockGate.status,
  subscribeReplayGateStatus: (
    listener: (status: IReplayGateStatus) => void,
  ) => {
    mockStatusListeners.push(listener);
    return () => undefined;
  },
}));

type IDesktopReplayModule = typeof import('./replay.desktop');

const OPTIONS: IInitSessionReplayOptions = {
  instanceId: 'instance-1',
  enableTestEndpoint: true,
  forceRecord: false,
};

function setGateStatus(status: Partial<IReplayGateStatus>) {
  mockGate.status = { ...mockGate.status, ...status };
  mockStatusListeners.forEach((listener) => listener(mockGate.status));
}

function lastRegistration(): IReplayControllerRegistration {
  const { calls } = mockRegister.mock;
  return calls[calls.length - 1][0];
}

function lastController(): IDesktopController {
  return lastRegistration().controller as IDesktopController;
}

function onlyInstance(): MockPostHog {
  expect(MockPostHog.instances).toHaveLength(1);
  return MockPostHog.instances[0];
}

function beforeSendOf(instance: MockPostHog): BeforeSendFn {
  return instance.config?.before_send as BeforeSendFn;
}

function snapshotEvent(sessionId: string, timestamps: number[]): CaptureResult {
  return {
    uuid: 'uuid',
    event: '$snapshot',
    properties: {
      $session_id: sessionId,
      $snapshot_data: timestamps.map((timestamp) => ({
        type: 4,
        timestamp,
        data: { href: 'file:///Users/alice/build/index.html' },
      })),
    },
  };
}

describe('replay.desktop', () => {
  let replay: IDesktopReplayModule;

  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    MockPostHog.instances = [];
    mockStatusListeners.length = 0;
    mockRegister.mockClear();
    mockUnregister.mockClear();
    mockNotifyActivity.mockClear();
    mockRecorderLoaded.mockClear();
    mockPlatformEnv.isDesktop = true;
    mockPlatformEnv.isDev = false;
    mockPlatformEnv.isE2E = false;
    mockProjectConfig.token = 'phc_test_token';
    mockGate.status = {
      hasController: true,
      sampled: true,
      forced: false,
      recording: false,
      pauseReasons: [],
    };
    replay = await import('./replay.desktop');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('init guards', () => {
    it('does nothing outside the desktop renderer', async () => {
      mockPlatformEnv.isDesktop = false;
      await replay.initSessionReplay(OPTIONS);
      expect(MockPostHog.instances).toHaveLength(0);
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('skips dev builds unless the test endpoint is on', async () => {
      mockPlatformEnv.isDev = true;
      await replay.initSessionReplay({ ...OPTIONS, enableTestEndpoint: false });
      expect(MockPostHog.instances).toHaveLength(0);
      await replay.initSessionReplay(OPTIONS);
      expect(MockPostHog.instances).toHaveLength(1);
    });

    it('skips when the token is missing and never throws', async () => {
      mockProjectConfig.token = undefined;
      await expect(replay.initSessionReplay(OPTIONS)).resolves.toBeUndefined();
      expect(MockPostHog.instances).toHaveLength(0);
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('creates one dedicated instance with replay-only config', async () => {
      await replay.initSessionReplay(OPTIONS);
      const instance = onlyInstance();
      expect(instance.token).toBe('phc_test_token');
      const config = instance.config as Partial<PostHogConfig>;
      expect(config).toMatchObject({
        api_host: 'https://eu.i.posthog.com',
        bootstrap: { distinctID: 'instance-1' },
        persistence: 'localStorage',
        persistence_name: 'ph_replay',
        disable_session_recording: true,
        disable_external_dependency_loading: true,
        advanced_disable_feature_flags: true,
        autocapture: false,
        rageclick: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_performance: false,
        enable_recording_console_log: false,
        disable_surveys: true,
      });
      expect(config.advanced_disable_flags).toBeUndefined();
      expect(config.session_recording).toMatchObject({
        sampleRate: 1,
        maskAllInputs: true,
        maskTextSelector: '*',
        recordCrossOriginIframes: false,
        captureCanvas: { recordCanvas: false },
        compress_events: false,
      });
      expect(config.session_recording?.blockSelector).toContain('iframe');
      expect(config.session_recording?.blockSelector).toContain('webview');
      expect(
        config.session_recording?.maskCapturedNetworkRequestFn?.({
          name: 'file:///Users/alice/build/index.html?x=1',
        } as CapturedNetworkRequest),
      ).toMatchObject({ name: '/' });
      // The launch touch created the session before registration.
      expect(lastController().getSessionId()).toBe(SAMPLED_SID);
      expect(lastRegistration()).toMatchObject({
        threshold: 300,
        forced: false,
      });
      expect(mockRecorderLoaded).not.toHaveBeenCalled();
    });

    it('forces only with the test endpoint and updates on re-init', async () => {
      await replay.initSessionReplay({ ...OPTIONS, forceRecord: true });
      expect(lastRegistration().forced).toBe(true);
      const controller = lastController();
      await replay.initSessionReplay({ ...OPTIONS, forceRecord: false });
      expect(lastRegistration().forced).toBe(false);
      expect(lastController()).toBe(controller);
      expect(MockPostHog.instances).toHaveLength(1);
    });

    it('disables replay until reload when the identity changes', async () => {
      await replay.initSessionReplay(OPTIONS);
      await replay.initSessionReplay({ ...OPTIONS, instanceId: 'instance-2' });
      expect(mockUnregister).toHaveBeenCalledTimes(1);
      await replay.initSessionReplay(OPTIONS);
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });
  });

  describe('controller', () => {
    it('loads the recorder once and starts without an override', async () => {
      await replay.initSessionReplay(OPTIONS);
      const instance = onlyInstance();
      const controller = lastController();
      await controller.prepare?.();
      await controller.start();
      await controller.start();
      expect(mockRecorderLoaded).toHaveBeenCalledTimes(1);
      expect(instance.calls).toEqual(['start', 'start']);
      await expect(controller.isRecordingActive?.()).resolves.toBe(true);
      await controller.stop();
      expect(instance.calls[instance.calls.length - 1]).toBe('stop');
      await expect(controller.isRecordingActive?.()).resolves.toBe(false);
    });

    it('refuses to start while the gate reports a pause', async () => {
      await replay.initSessionReplay(OPTIONS);
      const instance = onlyInstance();
      setGateStatus({ pauseReasons: ['sensitive'] });
      await lastController().start();
      expect(instance.calls).toEqual([]);
    });

    it('refuses to start an unsampled session unless forced', async () => {
      await replay.initSessionReplay(OPTIONS);
      const instance = onlyInstance();
      instance.props.$sesid = [NOW, UNSAMPLED_SID, NOW];
      await lastController().start();
      expect(instance.calls).toEqual([]);

      await replay.initSessionReplay({ ...OPTIONS, forceRecord: true });
      await lastController().start();
      expect(instance.calls).toEqual(['start']);
    });

    it('hides sessions that would rotate from getSessionId', async () => {
      await replay.initSessionReplay(OPTIONS);
      const instance = onlyInstance();
      instance.props.$sesid = [
        NOW - SESSION_TIMEOUT_MS - 1,
        SAMPLED_SID,
        NOW - SESSION_TIMEOUT_MS - 1,
      ];
      expect(lastController().getSessionId()).toBeUndefined();
    });

    it('stops before an idle session rotates while recording', async () => {
      await replay.initSessionReplay(OPTIONS);
      const instance = onlyInstance();
      const controller = lastController();
      await controller.start();
      instance.calls.length = 0;
      instance.sessionManager?.nextIds.push(UNSAMPLED_SID);
      instance.props.$sesid = [
        NOW - SESSION_TIMEOUT_MS - 1,
        SAMPLED_SID,
        NOW - SESSION_TIMEOUT_MS - 1,
      ];
      await expect(controller.touchSession()).resolves.toBe(UNSAMPLED_SID);
      expect(instance.calls).toEqual(['stop']);
      // The gate learns the id from touchSession itself.
      jest.runOnlyPendingTimers();
      expect(mockNotifyActivity).not.toHaveBeenCalled();
    });

    it('keeps recording when the session only gets touched', async () => {
      await replay.initSessionReplay(OPTIONS);
      const instance = onlyInstance();
      const controller = lastController();
      await controller.start();
      instance.calls.length = 0;
      jest.setSystemTime(NOW + 60_000);
      await expect(controller.touchSession()).resolves.toBe(SAMPLED_SID);
      expect(instance.calls).toEqual([]);
    });

    it('asks the gate to re-check after the SDK rotates on its own', async () => {
      await replay.initSessionReplay(OPTIONS);
      const instance = onlyInstance();
      instance.props.$sesid = undefined;
      instance.sessionManager?.checkAndGetSessionAndWindowId(false);
      expect(mockNotifyActivity).not.toHaveBeenCalled();
      jest.runOnlyPendingTimers();
      expect(mockNotifyActivity).toHaveBeenCalledTimes(1);
    });
  });

  describe('before_send backstop', () => {
    it('only lets snapshots of sampled sessions through, scrubbed', async () => {
      await replay.initSessionReplay(OPTIONS);
      const beforeSend = beforeSendOf(onlyInstance());
      await lastController().start();

      expect(
        beforeSend({ uuid: 'u', event: '$pageview', properties: {} }),
      ).toBeNull();
      expect(beforeSend(null)).toBeNull();
      expect(beforeSend(snapshotEvent(UNSAMPLED_SID, [NOW]))).toBeNull();

      const kept = beforeSend(snapshotEvent(SAMPLED_SID, [NOW]));
      expect(kept?.properties.$snapshot_data).toEqual([
        { type: 4, timestamp: NOW, data: { href: '/' } },
      ]);
    });

    it('drops events emitted after the gate paused, keeps earlier ones', async () => {
      await replay.initSessionReplay(OPTIONS);
      const beforeSend = beforeSendOf(onlyInstance());
      const controller = lastController();
      await controller.start();

      jest.setSystemTime(NOW + 1000);
      setGateStatus({ pauseReasons: ['sensitive'] });
      const event = beforeSend(
        snapshotEvent(SAMPLED_SID, [NOW + 500, NOW + 1000, NOW + 1500]),
      );
      expect(
        (event?.properties.$snapshot_data as { timestamp: number }[]).map(
          (item) => item.timestamp,
        ),
      ).toEqual([NOW + 500]);
      expect(beforeSend(snapshotEvent(SAMPLED_SID, [NOW + 2000]))).toBeNull();

      jest.setSystemTime(NOW + 3000);
      setGateStatus({ pauseReasons: [] });
      await controller.start();
      expect(
        beforeSend(snapshotEvent(SAMPLED_SID, [NOW + 2000, NOW + 3500]))
          ?.properties.$snapshot_data,
      ).toHaveLength(1);
    });

    it('blocks everything before the first start', async () => {
      await replay.initSessionReplay(OPTIONS);
      const beforeSend = beforeSendOf(onlyInstance());
      setGateStatus({ pauseReasons: ['outOfScope'] });
      expect(beforeSend(snapshotEvent(SAMPLED_SID, [NOW + 1]))).toBeNull();
    });
  });
});
