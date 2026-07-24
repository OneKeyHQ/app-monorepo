/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ensurePrimePurchaseEligible } from './primePurchaseEligibility';

const mockApiFetchPrimeUserInfo = jest.fn();
const mockToastError = jest.fn();
const mockToastMessage = jest.fn();
const mockShowToastOfError = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    message: (...args: unknown[]) => mockToastMessage(...args),
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiFetchPrimeUserInfo: (...args: unknown[]) =>
        mockApiFetchPrimeUserInfo(...args),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfError: jest.fn(),
    showToastOfError: (...args: unknown[]) => mockShowToastOfError(...args),
  },
}));

function buildUserInfo({
  oneKeyUserId = 'user-1',
  isPrimeActive = false,
}: {
  oneKeyUserId?: string;
  isPrimeActive?: boolean;
} = {}) {
  return {
    userInfo: {
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: oneKeyUserId,
    },
    primeSubscription: isPrimeActive
      ? {
          isActive: true,
        }
      : undefined,
  };
}

describe('ensurePrimePurchaseEligible', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forces a fresh server check before allowing payment', async () => {
    mockApiFetchPrimeUserInfo.mockResolvedValue(buildUserInfo());

    await expect(
      ensurePrimePurchaseEligible({ expectedOneKeyUserId: 'user-1' }),
    ).resolves.toBe(true);

    expect(mockApiFetchPrimeUserInfo).toHaveBeenCalledWith({
      forceRefresh: true,
    });
  });

  it('blocks payment when Prime is already active', async () => {
    mockApiFetchPrimeUserInfo.mockResolvedValue(
      buildUserInfo({ isPrimeActive: true }),
    );

    await expect(
      ensurePrimePurchaseEligible({ expectedOneKeyUserId: 'user-1' }),
    ).resolves.toBe(false);

    expect(mockToastMessage).toHaveBeenCalledTimes(1);
  });

  it('blocks payment when the OneKey ID changes during the check', async () => {
    mockApiFetchPrimeUserInfo.mockResolvedValue(
      buildUserInfo({ oneKeyUserId: 'user-2' }),
    );

    await expect(
      ensurePrimePurchaseEligible({ expectedOneKeyUserId: 'user-1' }),
    ).resolves.toBe(false);

    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent checks for the same OneKey ID', async () => {
    let resolveRequest:
      | ((value: ReturnType<typeof buildUserInfo>) => void)
      | undefined;
    mockApiFetchPrimeUserInfo.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = ensurePrimePurchaseEligible({
      expectedOneKeyUserId: 'user-1',
    });
    const second = ensurePrimePurchaseEligible({
      expectedOneKeyUserId: 'user-1',
    });
    resolveRequest?.(buildUserInfo());

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(mockApiFetchPrimeUserInfo).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the server check fails', async () => {
    const error = new Error('network failed');
    mockApiFetchPrimeUserInfo.mockRejectedValue(error);

    await expect(
      ensurePrimePurchaseEligible({ expectedOneKeyUserId: 'user-1' }),
    ).resolves.toBe(false);

    expect(mockShowToastOfError).toHaveBeenCalledWith(error);
  });

  it('allows the user to retry after a failed server check', async () => {
    mockApiFetchPrimeUserInfo
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce(buildUserInfo());

    await expect(
      ensurePrimePurchaseEligible({ expectedOneKeyUserId: 'user-1' }),
    ).resolves.toBe(false);
    await expect(
      ensurePrimePurchaseEligible({ expectedOneKeyUserId: 'user-1' }),
    ).resolves.toBe(true);

    expect(mockApiFetchPrimeUserInfo).toHaveBeenCalledTimes(2);
  });
});
