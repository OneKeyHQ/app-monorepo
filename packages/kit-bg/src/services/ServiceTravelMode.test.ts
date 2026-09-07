import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import ServiceTravelMode from './ServiceTravelMode';

const mockGetPersistedEnabled = jest.fn(async () => true);
const mockVerifyPassword = jest.fn(async (_params: unknown) => undefined);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
  },
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironment: jest.fn(async () => ({
      persistence: {
        run: <T>({ operation }: { operation: () => Promise<T> }) => operation(),
      },
    })),
    getRuntimeEnvironmentSync: jest.fn(() => ({
      persistence: {
        runSync: <T>({ operation }: { operation: () => T }) => operation(),
      },
    })),
    getPersistedEnabled: () => mockGetPersistedEnabled(),
    getRuntimeState: jest.fn(async () => 'active'),
    markRestartFailed: jest.fn(),
    transition: jest.fn(async () => undefined),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/travelMode/nativeLaunchEpoch', () => ({
  prepareTravelModeRuntimeRestart: jest.fn(async () => 7),
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getContext: jest.fn(),
    getContextVerifyStringInner: jest.fn(),
    verifyPassword: async (params: unknown) => {
      await mockVerifyPassword(params);
    },
  },
}));

describe('ServiceTravelMode authentication boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    platformEnv.isNative = true;
    jest
      .mocked(generateUUID)
      .mockReturnValueOnce('admission-1')
      .mockReturnValueOnce('admission-2');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires a fresh protected manual prompt for every page admission', async () => {
    const promptPasswordVerify = jest.fn(async () => ({
      password: 'encoded-password',
    }));
    const service = new ServiceTravelMode({
      backgroundApi: {
        servicePassword: { promptPasswordVerify },
      },
    });

    const first = await service.requestPageAdmission();
    const second = await service.requestPageAdmission();

    expect(first).toEqual({ admissionId: 'admission-1' });
    expect(second).toEqual({ admissionId: 'admission-2' });
    expect(promptPasswordVerify).toHaveBeenCalledTimes(2);
    expect(promptPasswordVerify).toHaveBeenNthCalledWith(1, {
      enforcePasswordErrorProtection: true,
      manualPasswordOnly: true,
      reason: EReasonForNeedPassword.Security,
      skipPostVerifyBackgroundTasks: true,
    });
    expect(promptPasswordVerify).toHaveBeenNthCalledWith(2, {
      enforcePasswordErrorProtection: true,
      manualPasswordOnly: true,
      reason: EReasonForNeedPassword.Security,
      skipPostVerifyBackgroundTasks: true,
    });

    await expect(
      service.enterPage({ admissionId: first.admissionId }),
    ).rejects.toThrow('Unknown error');
    await expect(
      service.enterPage({ admissionId: second.admissionId }),
    ).resolves.toEqual({ enabled: true, restartRequired: false });
  });

  it('invalidates admission immediately when the page is left', async () => {
    const service = new ServiceTravelMode({
      backgroundApi: {
        servicePassword: {
          promptPasswordVerify: jest.fn(async () => ({
            password: 'encoded-password',
          })),
        },
      },
    });
    const { admissionId } = await service.requestPageAdmission();
    await service.enterPage({ admissionId });

    await service.leavePage({ admissionId });

    await expect(service.enterPage({ admissionId })).rejects.toThrow(
      'Unknown error',
    );
    expect(mockGetPersistedEnabled).toHaveBeenCalledTimes(1);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it('authorizes a toggle through the admitted page cache with brute-force protection enabled', async () => {
    const promptPasswordVerify = jest.fn(async () => ({
      password: 'encoded-password',
    }));
    const service = new ServiceTravelMode({
      backgroundApi: {
        serviceApp: {
          restartApp: jest.fn(async () => {
            throw new OneKeyLocalError('restart failed');
          }),
        },
        servicePassword: { promptPasswordVerify },
      },
    });
    const { admissionId } = await service.requestPageAdmission();
    await service.enterPage({ admissionId });

    await expect(
      service.setEnabled({ admissionId, enabled: false }),
    ).rejects.toThrow('restart failed');

    expect(promptPasswordVerify).toHaveBeenNthCalledWith(2, {
      enforcePasswordErrorProtection: true,
      manualPasswordOnly: true,
      skipPostVerifyBackgroundTasks: true,
    });
    expect(mockVerifyPassword).toHaveBeenCalledWith({
      password: 'encoded-password',
      skipLazyUpgrade: true,
    });
    expect(timerUtils.wait).toHaveBeenCalledWith(3000);
  });
});
