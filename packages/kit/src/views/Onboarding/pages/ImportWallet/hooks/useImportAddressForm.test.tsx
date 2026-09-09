/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import { EImportMethod, useImportAddressForm } from './useImportAddressForm';

const networkIds = getNetworkIdsMap();
const mockNetworksResp = {
  networkIds: [networkIds.btc, networkIds.eth],
  publicKeyExportEnabled: new Set([networkIds.btc]),
  watchingAccountEnabled: new Set([networkIds.btc, networkIds.eth]),
};
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

jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

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
    expect(result.current.validateResult?.isValid).toBe(true);
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
