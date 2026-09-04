import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  setTravelModePushSuppressed,
  travelModeManager,
} from '@onekeyhq/shared/src/travelMode';
import { prepareTravelModeRuntimeRestart } from '@onekeyhq/shared/src/travelMode/nativeLaunchEpoch';
import { rejectTravelModeUnknownError } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import localDb from '../dbs/local/localDb';

import ServiceBase from './ServiceBase';
import { TravelModeTransitionController } from './ServiceTravelMode/TravelModeTransitionController';

const PAGE_ADMISSION_TTL_MS = 60_000;
const TRAVEL_MODE_RESTART_LOADING_DURATION_MS = 3000;

@backgroundClass()
export default class ServiceTravelMode extends ServiceBase {
  private pageAdmissions = new Map<string, number>();

  private readonly transitionController = new TravelModeTransitionController({
    authenticateToggle: () =>
      this.backgroundApi.servicePassword.promptPasswordVerify({
        enforcePasswordErrorProtection: true,
        manualPasswordOnly: true,
        skipPostVerifyBackgroundTasks: true,
      }),
    clearSensitiveCaches: () => localDb.clearStoreCachedData(),
    getPersistedEnabled: () => travelModeManager.getPersistedEnabled(),
    getPortableVerifyString: async () => {
      const context = await localDb.getContext();
      return localDb.getContextVerifyStringInner({ context });
    },
    getRuntimeState: () => travelModeManager.getRuntimeState(),
    markRestartFailed: () => travelModeManager.markRestartFailed(),
    persistTransition: (params) => travelModeManager.transition(params),
    prepareRestart: (profile) => prepareTravelModeRuntimeRestart(profile),
    restart: (reason) =>
      this.backgroundApi.serviceApp.restartApp({
        mode: EAppRestartMode.All,
        reason,
      }),
    setPushSuppressed: (suppressed) => setTravelModePushSuppressed(suppressed),
    verifyPassword: (password) =>
      localDb.verifyPassword({ password, skipLazyUpgrade: true }),
    waitBeforeRestart: async () => {
      await timerUtils.wait(TRAVEL_MODE_RESTART_LOADING_DURATION_MS);
    },
  });

  private async assertNative(): Promise<void> {
    if (!platformEnv.isNative) {
      await rejectTravelModeUnknownError();
    }
  }

  private async assertPageAdmission(admissionId: string): Promise<void> {
    await this.assertNative();
    const expiresAt = this.pageAdmissions.get(admissionId);
    if (!expiresAt || expiresAt < Date.now()) {
      this.pageAdmissions.delete(admissionId);
      await rejectTravelModeUnknownError();
    }
  }

  @backgroundMethod()
  async requestPageAdmission(): Promise<{ admissionId: string }> {
    await this.assertNative();
    await this.backgroundApi.servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.Security,
      enforcePasswordErrorProtection: true,
      manualPasswordOnly: true,
      skipPostVerifyBackgroundTasks: true,
    });
    this.pageAdmissions.clear();
    const admissionId = generateUUID();
    this.pageAdmissions.set(admissionId, Date.now() + PAGE_ADMISSION_TTL_MS);
    return { admissionId };
  }

  @backgroundMethod()
  async enterPage({
    admissionId,
  }: {
    admissionId: string;
  }): Promise<{ enabled: boolean; restartRequired: boolean }> {
    await this.assertPageAdmission(admissionId);
    this.pageAdmissions.set(admissionId, Number.POSITIVE_INFINITY);
    const [enabled, runtimeState] = await Promise.all([
      travelModeManager.getPersistedEnabled(),
      travelModeManager.getRuntimeState(),
    ]);
    return {
      enabled,
      restartRequired: runtimeState !== 'active' && runtimeState !== 'inactive',
    };
  }

  @backgroundMethod()
  async leavePage({ admissionId }: { admissionId: string }): Promise<void> {
    this.pageAdmissions.delete(admissionId);
  }

  @backgroundMethod()
  async setEnabled({
    admissionId,
    enabled,
  }: {
    admissionId: string;
    enabled: boolean;
  }): Promise<void> {
    await this.assertPageAdmission(admissionId);
    await this.transitionController.setEnabled(enabled);
  }

  @backgroundMethod()
  async retryRestart({ admissionId }: { admissionId: string }): Promise<void> {
    await this.assertPageAdmission(admissionId);
    await this.transitionController.retryRestart();
  }
}
