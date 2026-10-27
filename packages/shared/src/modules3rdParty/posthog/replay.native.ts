// Session Replay controller for iOS / Android.
//
// Runtime: native `main` only. `bg` never imports this module or the plugin.
// Native resources: PostHogSDK.shared (iOS) and the PostHog singleton
// (Android) are process-wide and survive in-app JS reloads; the plugin JS is
// loaded with import() only when a sampled session first starts recording.
//
// Drives @posthog/react-native-plugin directly: setup() with
// sessionReplay.enabled=false, then explicit startRecording(true) /
// stopRecording(), so the native SDK never restarts capture on its own after
// a stop (late remote config, re-sampling, session change).

import { AppState, NativeModules, TurboModuleRegistry } from 'react-native';

import platformEnv from '../../platformEnv';

import {
  REPLAY_SAMPLE_THRESHOLDS,
  getReplayProjectConfig,
} from './replayConfig';
import { stopLeftoverNativeReplay } from './replayEarlyStop';
import {
  registerReplayController,
  unregisterReplayController,
} from './replayGate';
import {
  getReplaySessionId,
  markReplaySessionBackground,
  markReplaySessionForeground,
  touchReplaySession,
} from './replaySession.native';

import type { IReplayControllerExtensions } from './replayGate';
import type {
  IInitSessionReplayOptions,
  IReplayController,
  IReplayPlatform,
} from './replayTypes';
import type {
  PostHogReactNativePluginConfig,
  PostHogReactNativePluginMap,
  PostHogReactNativePluginModule,
} from '@posthog/react-native-plugin';
import type { AppStateStatus } from 'react-native';

const PLUGIN_NATIVE_MODULE_NAME = 'PosthogReactNativePlugin';

// Must be non-empty: it puts both native SDKs into React Native mode, where
// they keep the session id passed in instead of rotating their own.
export const REPLAY_PLUGIN_SDK_VERSION = '2.12.6';

type IPluginNativeModule = {
  stopRecording: () => Promise<void>;
};

type INativeReplayController = IReplayController & IReplayControllerExtensions;

export function buildReplaySdkOptions({
  token,
  host,
  instanceId,
}: {
  token: string;
  host: string;
  instanceId: string;
}): PostHogReactNativePluginMap {
  return {
    apiKey: token,
    host,
    distinctId: instanceId,
    anonymousId: instanceId,
    sdkVersion: REPLAY_PLUGIN_SDK_VERSION,
    preloadFeatureFlags: false,
    optOut: false,
    flushAt: 20,
  };
}

// Every side effect the SDK enables by default is switched off explicitly.
// Keys a platform does not read are listed in the v1 report; they are kept so
// both platforms receive the same intent.
export function buildReplayPluginConfig(): PostHogReactNativePluginConfig {
  return {
    sessionReplay: {
      enabled: false,
      decideReplayConfig: {},
      sdkReplayConfig: {
        maskAllTextInputs: true,
        maskAllImages: true,
        maskAllSandboxedViews: true,
        captureLog: false,
        captureNetworkTelemetry: false,
        captureTouches: false,
        throttleDelayMs: 1000,
        sampleRate: 1,
        screenshotModeBackgroundCapture: false,
        // Android only: drops frames whose masks no longer line up with the
        // drawn content, e.g. while an overlay animates in before the stop.
        verifyScreenshotMaskAlignment: true,
      },
    },
    errorTracking: {
      nativeAutocapture: false,
      androidNdkCrashes: false,
      fatalExceptionMarker: false,
    },
    push: {
      capturePushNotificationSubscriptions: false,
      capturePushNotificationOpened: false,
      pushIdentityProviderEnabled: false,
    },
    rageClick: { enabled: false },
  };
}

// A JS bundle can run on a native build without the plugin (hot update), so
// presence is checked before anything touches it.
function resolvePluginNativeModule(): IPluginNativeModule | undefined {
  try {
    const nativeModule = (TurboModuleRegistry.get(PLUGIN_NATIVE_MODULE_NAME) ??
      NativeModules[PLUGIN_NATIVE_MODULE_NAME]) as
      | IPluginNativeModule
      | null
      | undefined;
    return nativeModule && typeof nativeModule.stopRecording === 'function'
      ? nativeModule
      : undefined;
  } catch {
    return undefined;
  }
}

function getReplayPlatform(): IReplayPlatform | undefined {
  if (platformEnv.isNativeIOS) {
    return 'ios';
  }
  if (platformEnv.isNativeAndroid) {
    return 'android';
  }
  return undefined;
}

async function loadPlugin(): Promise<PostHogReactNativePluginModule> {
  const pluginModule = await import('@posthog/react-native-plugin');
  return pluginModule.default;
}

function createNativeReplayController({
  platform,
  nativeModule,
  sdkOptions,
}: {
  platform: IReplayPlatform;
  nativeModule: IPluginNativeModule;
  sdkOptions: PostHogReactNativePluginMap;
}): INativeReplayController {
  let setupRequested = false;
  let pluginPromise:
    | Promise<PostHogReactNativePluginModule | undefined>
    | undefined;

  const ensureSetup = (): Promise<
    PostHogReactNativePluginModule | undefined
  > => {
    if (!pluginPromise) {
      setupRequested = true;
      const attempt = (async () => {
        const plugin = await loadPlugin();
        const sessionId =
          getReplaySessionId() ?? touchReplaySession().sessionId;
        await plugin.setup(sessionId, sdkOptions, buildReplayPluginConfig());
        return plugin;
      })();
      // A failed load or link is retried by the gate's next start attempt.
      pluginPromise = attempt.catch(() => {
        pluginPromise = undefined;
        return undefined;
      });
    }
    return pluginPromise;
  };

  const settledPlugin = async (): Promise<
    PostHogReactNativePluginModule | undefined
  > => (pluginPromise ? pluginPromise : undefined);

  const stopNow = async (): Promise<void> => {
    const plugin = await settledPlugin();
    if (plugin) {
      await plugin.stopRecording();
      return;
    }
    await nativeModule.stopRecording();
  };

  return {
    platform,
    getSessionId: () => getReplaySessionId(),
    touchSession: async () => {
      const { sessionId, previousSessionId } = touchReplaySession(Date.now());
      if (
        previousSessionId !== undefined &&
        previousSessionId !== sessionId &&
        setupRequested
      ) {
        // Stop before switching ids: the new session may not be sampled, and
        // the gate restarts capture when it is. iOS resets its replay buffer
        // on every id it is given, so this only runs on a real change.
        await stopNow();
        const plugin = await settledPlugin();
        if (plugin) {
          await plugin.endSession();
          await plugin.startSession(sessionId);
        }
      }
      return sessionId;
    },
    prepare: async () => {
      await ensureSetup();
    },
    start: async () => {
      const plugin = await ensureSetup();
      if (plugin) {
        // resumeCurrent=false would ask the SDK for a new session; OneKey owns
        // the session id.
        await plugin.startRecording(true);
      }
    },
    stop: async () => {
      // Nothing can have started in this JS context before setup; recording
      // left over from a previous context was stopped during init.
      if (!setupRequested) {
        return;
      }
      await stopNow();
    },
    isRecordingActive: async () => {
      const plugin = await settledPlugin();
      return plugin ? plugin.isEnabled() : false;
    },
  };
}

// One controller per JS context, bound to the project and identity it was
// created with: the native SDK keeps its first setup for the whole process.
type IContextController = {
  controller: INativeReplayController;
  enableTestEndpoint: boolean;
  instanceId: string;
};

let contextController: IContextController | undefined;
let registered = false;
// Set when a later init asks for a different project or identity. Replay
// stays off until the app restarts.
let disabledUntilRestart = false;
let appStateSubscription: { remove: () => void } | undefined;
let initChain: Promise<void> = Promise.resolve();

function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'background') {
    markReplaySessionBackground(Date.now());
  } else if (state === 'active') {
    markReplaySessionForeground();
  }
}

function deactivate(): void {
  if (registered) {
    registered = false;
    unregisterReplayController();
  }
}

async function initSessionReplayInContext(
  options: IInitSessionReplayOptions,
): Promise<void> {
  if (!platformEnv.isNativeMainThread || disabledUntilRestart) {
    return;
  }
  const platform = getReplayPlatform();
  const nativeModule = resolvePluginNativeModule();
  if (!platform || !nativeModule) {
    return;
  }
  // Normally already done at startup by the route gate; awaited here so the
  // leftover stop always lands before setup or start.
  await stopLeftoverNativeReplay();

  const enableTestEndpoint = Boolean(options.enableTestEndpoint);
  const { instanceId } = options;
  const { token, host } = getReplayProjectConfig(enableTestEndpoint);
  const buildAllowed =
    !(platformEnv.isDev || platformEnv.isE2E) || enableTestEndpoint;
  if (!buildAllowed || !token || !instanceId) {
    deactivate();
    return;
  }

  if (
    contextController &&
    (contextController.enableTestEndpoint !== enableTestEndpoint ||
      contextController.instanceId !== instanceId)
  ) {
    deactivate();
    disabledUntilRestart = true;
    return;
  }

  if (!contextController) {
    // Cold-start read of the persisted session.
    touchReplaySession(Date.now());
    appStateSubscription ??= AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    contextController = {
      controller: createNativeReplayController({
        platform,
        nativeModule,
        sdkOptions: buildReplaySdkOptions({ token, host, instanceId }),
      }),
      enableTestEndpoint,
      instanceId,
    };
  }

  // Re-registering the same controller only updates threshold and forced.
  registered = true;
  registerReplayController({
    controller: contextController.controller,
    threshold: REPLAY_SAMPLE_THRESHOLDS[platform],
    forced: Boolean(options.forceRecord) && enableTestEndpoint,
  });
}

// Never throws. Calls are serialized; a later call with the same project and
// identity only updates the forced flag.
export async function initSessionReplay(
  options: IInitSessionReplayOptions,
): Promise<void> {
  const run = initChain
    .then(() => initSessionReplayInContext(options))
    .catch(() => undefined);
  initChain = run;
  await run;
}
