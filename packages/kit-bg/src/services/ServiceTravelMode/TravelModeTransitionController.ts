import { Semaphore } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ITravelModeRuntimeState } from '@onekeyhq/shared/src/travelMode';
import { rejectTravelModeUnknownError } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';

const TRAVEL_MODE_RESTART_TIMEOUT_MS = 10_000;

export type ITravelModeTransitionControllerDependencies = {
  authenticateToggle: () => Promise<{ password: string }>;
  getPersistedEnabled: () => Promise<boolean>;
  getPortableVerifyString: () => Promise<string>;
  getRuntimeState: () => Promise<ITravelModeRuntimeState>;
  markRestartFailed: () => void;
  persistTransition: (params: {
    enabled: boolean;
    verifyString?: string;
  }) => Promise<void>;
  prepareRestart: (profile: 'standard' | 'travel-mode') => Promise<number>;
  restart: (reason: string) => Promise<void>;
  restartTimeoutMs?: number;
  verifyPassword: (password: string) => Promise<void>;
  waitBeforeRestart: () => Promise<void>;
};

export class TravelModeTransitionController {
  private readonly transitionMutex = new Semaphore(1);

  constructor(
    private readonly dependencies: ITravelModeTransitionControllerDependencies,
  ) {}

  private async restartOrEnterRecovery({
    profile,
    reason,
  }: {
    profile: 'standard' | 'travel-mode';
    reason: string;
  }): Promise<never> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await this.dependencies.waitBeforeRestart();
      const epoch = await this.dependencies.prepareRestart(profile);
      await Promise.race([
        this.dependencies.restart(`${reason}-epoch-${epoch}`),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new OneKeyLocalError('Unknown error')),
            this.dependencies.restartTimeoutMs ??
              TRAVEL_MODE_RESTART_TIMEOUT_MS,
          );
          (
            timeout as ReturnType<typeof setTimeout> & { unref?: () => void }
          ).unref?.();
        }),
      ]);
    } catch (error) {
      this.dependencies.markRestartFailed();
      throw error;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    // A completed restart never resumes this runtime. Resolving here only
    // proves that the request returned, so keep the committed transition
    // fail-closed until a replacement runtime initializes from storage.
    this.dependencies.markRestartFailed();
    throw new OneKeyLocalError('Unknown error');
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.transitionMutex.runExclusive(async () => {
      const { password } = await this.dependencies.authenticateToggle();
      await this.dependencies.verifyPassword(password);

      let verifyString: string | undefined;
      if (enabled) {
        verifyString = await this.dependencies.getPortableVerifyString();
      }
      await this.dependencies.persistTransition({ enabled, verifyString });

      await this.restartOrEnterRecovery({
        profile: enabled ? 'travel-mode' : 'standard',
        reason: `travel-mode-${enabled ? 'enabled' : 'disabled'}`,
      });
    });
  }

  async retryRestart(): Promise<void> {
    await this.transitionMutex.runExclusive(async () => {
      if (
        (await this.dependencies.getRuntimeState()) !== 'transition-recovery'
      ) {
        await rejectTravelModeUnknownError();
      }
      const enabled = await this.dependencies.getPersistedEnabled();
      await this.restartOrEnterRecovery({
        profile: enabled ? 'travel-mode' : 'standard',
        reason: 'travel-mode-transition-recovery',
      });
    });
  }
}
