import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeFreeTrialError } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import { PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import ServiceAddressRiskCheck from './ServiceAddressRiskCheck';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
}));

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
};

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }

    async getOneKeyIdClient() {
      return mockClient;
    }
  },
}));

const mockUser: { isLoggedIn: boolean; onekeyUserId?: string } = {
  isLoggedIn: true,
  onekeyUserId: 'user-a',
};

jest.mock('../states/jotai/atoms/prime', () => ({
  primePersistAtom: {
    get: async () => ({ ...mockUser }),
  },
}));

const exhaustedError: IPrimeFreeTrialError = {
  code: PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
  data: {
    featureId: EPrimeFeatures.AddressRiskCheck,
    remaining: 0,
    resetAt: 2000,
  },
};

function createService() {
  const servicePrimeFreeTrial = {
    normalizeFreeTrialError: jest.fn(),
    handleFreeTrialErrorFromServer: jest.fn(async () => undefined),
    refreshQuota: jest.fn(async () => undefined),
  };
  const service = new ServiceAddressRiskCheck({
    backgroundApi: { servicePrimeFreeTrial },
  });
  return { service, servicePrimeFreeTrial };
}

describe('ServiceAddressRiskCheck.checkAddressRisk free trial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.isLoggedIn = true;
    mockUser.onekeyUserId = 'user-a';
  });

  it('hands a 90600 over for the user the check was sent as and rethrows it without a toast', async () => {
    const { service, servicePrimeFreeTrial } = createService();
    const rawError = new Error('server 90600');
    mockClient.post.mockImplementationOnce(async () => {
      // Another user logs in while the check is in flight.
      mockUser.onekeyUserId = 'user-b';
      throw rawError;
    });
    servicePrimeFreeTrial.normalizeFreeTrialError.mockReturnValueOnce(
      exhaustedError,
    );

    await expect(
      service.checkAddressRisk({ networkId: 'evm--1', address: '0xabc' }),
    ).rejects.toMatchObject({
      code: PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
      data: { featureId: EPrimeFeatures.AddressRiskCheck },
      autoToast: false,
    });
    expect(servicePrimeFreeTrial.normalizeFreeTrialError).toHaveBeenCalledWith({
      error: rawError,
      featureId: EPrimeFeatures.AddressRiskCheck,
    });
    expect(
      servicePrimeFreeTrial.handleFreeTrialErrorFromServer,
    ).toHaveBeenCalledWith(exhaustedError, { onekeyUserId: 'user-a' });
    expect(servicePrimeFreeTrial.refreshQuota).not.toHaveBeenCalled();
  });

  it('rethrows other errors untouched', async () => {
    const { service, servicePrimeFreeTrial } = createService();
    const rawError = new Error('server 90003');
    mockClient.post.mockRejectedValueOnce(rawError);
    servicePrimeFreeTrial.normalizeFreeTrialError.mockReturnValueOnce(
      undefined,
    );

    await expect(
      service.checkAddressRisk({ networkId: 'evm--1', address: '0xabc' }),
    ).rejects.toBe(rawError);
    expect(
      servicePrimeFreeTrial.handleFreeTrialErrorFromServer,
    ).not.toHaveBeenCalled();
  });

  it('refreshes the quota after a check that may have used a free check', async () => {
    const { service, servicePrimeFreeTrial } = createService();
    mockClient.post.mockResolvedValueOnce({
      data: { code: 0, data: { riskLevel: 'low' } },
    });

    await expect(
      service.checkAddressRisk({ networkId: 'evm--1', address: '0xabc' }),
    ).resolves.toEqual({ riskLevel: 'low' });
    expect(servicePrimeFreeTrial.refreshQuota).toHaveBeenCalledTimes(1);
  });
});
