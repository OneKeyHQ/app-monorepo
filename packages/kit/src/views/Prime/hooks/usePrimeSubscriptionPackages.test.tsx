/** @jest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';

import { usePrimeSubscriptionPackages } from './usePrimeSubscriptionPackages';

import type { IPackage } from './usePrimePaymentTypes';

const mockRequests: Array<() => Promise<IPackage[]>> = [];
const mockGetPackages = jest.fn<Promise<IPackage[]>, []>();
const mockGetStorefront = jest.fn<
  Promise<{ countryCode: string } | null>,
  []
>();
const mockDialogConfirm = jest.fn<void, [{ description: string }]>();
let mockInitializationError: Error | undefined;
let mockIsMas = true;
let mockMessages: Record<string, string> = enMessages;

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (request: () => Promise<IPackage[]>) => {
    mockRequests.push(request);
    return { result: [], isLoading: false };
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    confirm: (options: { description: string }) => mockDialogConfirm(options),
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => mockMessages[id] ?? id,
  }),
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ user: { onekeyUserId: 'user-a' } }),
}));
jest.mock('./usePrimePaymentMethods', () => ({
  usePrimePaymentMethods: () => ({
    isReady: true,
    initializationError: mockInitializationError,
    getPackagesNative: mockGetPackages,
    getStorefront: mockGetStorefront,
  }),
}));
jest.mock('./usePrimePaymentMethodsWeb', () => ({
  usePrimePaymentMethodsWeb: () => ({}),
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    withErrorAutoToast: (request: () => Promise<IPackage[]>) => request(),
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: { subscription: { fetchPackagesFailed: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isMas() {
      return mockIsMas;
    },
    get isNative() {
      return !mockIsMas;
    },
    get isNativeIOS() {
      return !mockIsMas;
    },
    isNativeAndroid: false,
  },
}));

function loadPackages() {
  renderHook(() => usePrimeSubscriptionPackages({ enabled: true }));
  expect(mockRequests).toHaveLength(2);
  return mockRequests[1]();
}

describe('Prime subscription loading feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequests.length = 0;
    mockInitializationError = undefined;
    mockIsMas = true;
    mockMessages = enMessages;
    mockGetPackages.mockResolvedValue([]);
    mockGetStorefront.mockResolvedValue({ countryCode: 'CHN' });
  });
  afterEach(cleanup);

  it.each([
    { platform: 'MAS', isMas: true, messages: enMessages, locale: 'en' },
    { platform: 'MAS', isMas: true, messages: zhMessages, locale: 'zh' },
    { platform: 'iOS', isMas: false, messages: enMessages, locale: 'en' },
    { platform: 'iOS', isMas: false, messages: zhMessages, locale: 'zh' },
  ])(
    'preserves initialization guidance on $platform in $locale',
    async ({ isMas, messages }) => {
      mockIsMas = isMas;
      mockMessages = messages;
      mockInitializationError = new OneKeyLocalError(
        messages[ETranslations.global_update_to_continue_desc_fallback],
      );
      mockGetPackages.mockRejectedValue(mockInitializationError);

      await expect(loadPackages()).rejects.toBe(mockInitializationError);
      expect(mockDialogConfirm).not.toHaveBeenCalled();
      expect(mockGetStorefront).not.toHaveBeenCalled();
    },
  );

  it('uses the China copy for a qualifying product error with CHN', async () => {
    mockMessages = zhMessages;
    mockGetPackages.mockRejectedValue({ code: '5' });
    await expect(loadPackages()).resolves.toEqual([]);
    expect(mockDialogConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          zhMessages[ETranslations.prime_subscription_china_storefront__msg],
      }),
    );
  });

  it.each([{ code: '10' }, { code: '35' }, { code: '32' }, { code: '2' }])(
    'keeps error %j on the existing generic fallback',
    async (error) => {
      mockGetPackages.mockRejectedValue(error);
      await expect(loadPackages()).resolves.toEqual([]);
      expect(mockDialogConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            enMessages[
              ETranslations.prime_unable_to_retrieve_subscription_list
            ],
        }),
      );
      expect(mockGetStorefront).not.toHaveBeenCalled();
    },
  );

  it('uses the generic fallback for an empty list without querying Storefront', async () => {
    await expect(loadPackages()).resolves.toEqual([]);
    expect(mockDialogConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          enMessages[ETranslations.prime_unable_to_retrieve_subscription_list],
      }),
    );
    expect(mockGetStorefront).not.toHaveBeenCalled();
  });
});
