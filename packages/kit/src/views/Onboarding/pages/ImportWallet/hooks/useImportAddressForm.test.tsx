/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import { EImportMethod, useImportAddressForm } from './useImportAddressForm';

const networkIds = getNetworkIdsMap();
const mockNetworksResp = {
  networkIds: [networkIds.btc, networkIds.eth],
  publicKeyExportEnabled: new Set([networkIds.btc, networkIds.ltc]),
  watchingAccountEnabled: new Set([networkIds.btc, networkIds.eth]),
};
const mockAddWatchingAccount = jest.fn(async () => undefined);
const mockValidatePublicKey = jest.fn(
  async (): Promise<IGeneralInputValidation> => ({ isValid: false }),
);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<
    typeof import('../../../../../../../components/src/hooks/useFormBase')
  >('../../../../../../../components/src/hooks/useFormBase'),
  Toast: { success: jest.fn() },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: {
      encodeSensitiveText: async ({ text }: { text: string }) => text,
    },
    serviceAccount: {
      addWatchingAccount: () => mockAddWatchingAccount(),
      ensureAccountNameNotDuplicate: async () => undefined,
      validateGeneralInputOfImporting: () => mockValidatePublicKey(),
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger',
  () => ({
    useAccountSelectorTrigger: () => ({
      activeAccount: { network: { id: networkIds.btc } },
    }),
  }),
);

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockNetworksResp }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useUserWalletProfile', () => ({
  useUserWalletProfile: () => ({ isSoftwareWalletOnlyUser: false }),
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({ useAccountSelectorActions: () => ({ current: {} }) }),
);

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));

describe('useImportAddressForm effective import method', () => {
  beforeEach(() => {
    mockAddWatchingAccount.mockReset();
    mockValidatePublicKey.mockReset();
    mockValidatePublicKey.mockResolvedValue({ isValid: false });
  });

  it('enables a valid address after switching from public key to an address-only network', async () => {
    const { result } = renderHook(() => useImportAddressForm({}));

    act(() => result.current.setMethod(EImportMethod.PublicKey));
    expect(result.current.isPublicKeyImport).toBe(true);

    await act(async () => {
      result.current.form.setValue('networkId', networkIds.eth);
      result.current.form.setValue('addressValue', {
        raw: 'fixture-address',
        resolved: 'fixture-address',
        pending: false,
      });
      await result.current.form.trigger();
    });

    expect(result.current.method).toBe(EImportMethod.PublicKey);
    expect(result.current.isPublicKeyImport).toBe(false);
    expect(result.current.isEnable).toBe(true);

    act(() => {
      result.current.form.setError('addressValue', {
        message: 'Invalid address',
      });
    });
    expect(result.current.isEnable).toBe(false);
  });

  it('uses address validation when switching back to Address on the same network', async () => {
    const { result } = renderHook(() => useImportAddressForm({}));

    act(() => {
      result.current.setMethod(EImportMethod.PublicKey);
      result.current.form.setValue('publicKeyValue', 'invalid-public-key');
    });
    await waitFor(() => {
      expect(result.current.validateResult?.isValid).toBe(false);
    });

    await act(async () => {
      result.current.setMethod(EImportMethod.Address);
      result.current.form.setValue('addressValue', {
        raw: 'fixture-address',
        resolved: 'fixture-address',
        pending: false,
      });
      await result.current.form.trigger();
    });

    expect(result.current.isPublicKeyImport).toBe(false);
    expect(result.current.isEnable).toBe(true);
  });

  it('keeps an address disabled when an old public-key validation succeeds after a network switch', async () => {
    let resolvePublicKey!: (value: IGeneralInputValidation) => void;
    mockValidatePublicKey.mockReturnValue(
      new Promise<IGeneralInputValidation>((resolve) => {
        resolvePublicKey = resolve;
      }),
    );
    const { result } = renderHook(() => useImportAddressForm({}));

    act(() => {
      result.current.setMethod(EImportMethod.PublicKey);
      result.current.form.setValue('publicKeyValue', 'fixture-public-key');
    });
    await waitFor(() => expect(mockValidatePublicKey).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.form.setValue('networkId', networkIds.eth);
      result.current.form.setValue('addressValue', {
        raw: 'fixture-address',
        pending: true,
      });
      await result.current.form.trigger();
    });
    await waitFor(() => {
      expect(result.current.validateResult?.isValid).toBe(false);
    });

    await act(async () => resolvePublicKey({ isValid: true }));
    expect(result.current.validateResult?.isValid).toBe(false);
    expect(result.current.isPublicKeyImport).toBe(false);
    expect(result.current.isEnable).toBe(false);

    await act(async () => {
      result.current.form.setValue('addressValue', {
        raw: 'fixture-address',
        pending: false,
      });
      await result.current.form.trigger();
    });
    expect(result.current.isEnable).toBe(false);
  });

  it('invalidates a successful key immediately during the debounce window', async () => {
    mockValidatePublicKey.mockResolvedValue({ isValid: true });
    const { result } = renderHook(() => useImportAddressForm({}));
    act(() => {
      result.current.setMethod(EImportMethod.PublicKey);
      result.current.form.setValue('publicKeyValue', 'first-key');
    });
    await waitFor(() => expect(result.current.isEnable).toBe(true));
    mockValidatePublicKey.mockResolvedValue({ isValid: false });
    act(() => result.current.form.setValue('publicKeyValue', 'invalid-key'));
    expect(result.current.isEnable).toBe(false);
    expect(result.current.validateResult).toBeUndefined();
    await waitFor(() =>
      expect(result.current.validateResult?.isValid).toBe(false),
    );
  });

  it('ignores an older successful request after a newer invalid key completes', async () => {
    let resolveOld!: (value: IGeneralInputValidation) => void;
    mockValidatePublicKey.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const { result } = renderHook(() => useImportAddressForm({}));
    act(() => {
      result.current.setMethod(EImportMethod.PublicKey);
      result.current.form.setValue('publicKeyValue', 'first-key');
    });
    await waitFor(() => expect(mockValidatePublicKey).toHaveBeenCalledTimes(1));
    act(() => result.current.form.setValue('publicKeyValue', 'invalid-key'));
    await waitFor(() =>
      expect(result.current.validateResult?.isValid).toBe(false),
    );
    await act(async () => resolveOld({ isValid: true }));
    expect(result.current.isEnable).toBe(false);
    expect(result.current.validateResult?.isValid).toBe(false);
  });

  it('clears validation and derivation when switching between public-key networks', async () => {
    mockValidatePublicKey.mockResolvedValue({ isValid: true });
    const { result } = renderHook(() => useImportAddressForm({}));
    act(() => {
      result.current.setMethod(EImportMethod.PublicKey);
      result.current.form.setValue('publicKeyValue', 'first-key');
    });
    await waitFor(() => expect(result.current.isEnable).toBe(true));
    act(() => result.current.form.setValue('deriveType', 'default'));
    mockValidatePublicKey.mockResolvedValue({ isValid: false });
    act(() => result.current.form.setValue('networkId', networkIds.ltc));
    expect(result.current.isPublicKeyImport).toBe(true);
    expect(result.current.isEnable).toBe(false);
    expect(result.current.form.getValues('deriveType')).toBeUndefined();
    await waitFor(() =>
      expect(result.current.validateResult?.isValid).toBe(false),
    );
  });

  it('rejects submission of a key changed before React commits', async () => {
    mockValidatePublicKey.mockResolvedValue({ isValid: true });
    const { result } = renderHook(() => useImportAddressForm({}));
    act(() => {
      result.current.setMethod(EImportMethod.PublicKey);
      result.current.form.setValue('publicKeyValue', 'first-key');
    });
    await waitFor(() => expect(result.current.isEnable).toBe(true));
    await act(async () => {
      result.current.form.setValue('publicKeyValue', 'unvalidated-key');
      await result.current.form.submit?.();
    });
    expect(mockAddWatchingAccount).not.toHaveBeenCalled();
  });

  it('keeps valid public-key imports enabled while still blocking account-name errors', async () => {
    mockValidatePublicKey.mockResolvedValue({ isValid: true });
    const { result } = renderHook(() => useImportAddressForm({}));

    act(() => {
      result.current.setMethod(EImportMethod.PublicKey);
      result.current.form.setValue('publicKeyValue', 'fixture-public-key');
      result.current.form.setError('addressValue', {
        message: 'Invalid address',
      });
    });
    await waitFor(() => expect(result.current.isEnable).toBe(true));

    act(() => {
      result.current.form.setError('accountName', {
        message: 'Duplicate name',
      });
    });
    expect(result.current.isEnable).toBe(false);
  });
});
