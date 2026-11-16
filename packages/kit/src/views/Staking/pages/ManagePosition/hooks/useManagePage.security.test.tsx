/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../utils/utils', () => ({
  buildLocalTxStatusSyncId: () => 'test-tag',
}));

import { renderHook } from '@testing-library/react-native';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EManagePositionType } from '@onekeyhq/shared/types/staking';

import { useManagePage } from './useManagePage';
import { buildManagePageRequestKey } from './useManagePage.utils';

const vault = '0xe9e8573bb351da16c6ee7ddac0cbc70b7f9784ae';
const attacker = '0x000000000000000000000000000000000000dead';
const params = {
  accountId: 'account-1',
  indexedAccountId: undefined,
  networkId: 'evm--56',
  symbol: 'USDT' as const,
  provider: 'Unitas',
  vault,
  type: EManagePositionType.Staking,
};

function response(selection = params) {
  // Deliberately return a usable form even for an invalid URL. The UI must
  // reject it independently of the server's own route validation.
  return {
    result: {
      requestKey: buildManagePageRequestKey(selection),
      protocolList: [
        {
          network: { networkId: 'evm--56' },
          provider: { name: 'Unitas', vault },
        },
      ],
      managePageData: {
        approve: { approveTarget: vault },
        deposit: {
          data: {
            balance: '10',
            token: {
              info: {
                address: '0x55d398326f99059ff775485246999027b3197955',
                isNative: false,
              },
              price: '1',
            },
          },
        },
      },
    },
    isLoading: false,
    run: jest.fn(),
    setResult: jest.fn(),
    setStopPolling: jest.fn(),
  } as ReturnType<typeof usePromiseResult>;
}

it('discards a valid-looking form for an unregistered route vault', () => {
  jest
    .mocked(usePromiseResult)
    .mockReturnValue(response({ ...params, vault: attacker }));
  const { result } = renderHook(() =>
    useManagePage({ ...params, vault: attacker }),
  );
  expect(result.current.protocolInfo).toBeUndefined();
  expect(result.current.tokenInfo).toBeUndefined();
});
it('drops the previous approval synchronously when switching account or vault', () => {
  jest.mocked(usePromiseResult).mockReturnValue(response());
  const { result, rerender } = renderHook(
    (selection: typeof params) => useManagePage(selection),
    { initialProps: params },
  );
  expect(result.current.protocolInfo?.vault).toBe(vault);
  rerender({ ...params, accountId: 'account-2' });
  expect(result.current.protocolInfo).toBeUndefined();
  expect(result.current.tokenInfo).toBeUndefined();
  rerender({ ...params, vault: attacker });
  expect(result.current.protocolInfo).toBeUndefined();
});
it('keeps the registered vault when the URL uses checksum casing', () => {
  const selection = { ...params, vault: vault.toUpperCase() };
  jest.mocked(usePromiseResult).mockReturnValue(response(selection));
  const { result } = renderHook(() => useManagePage(selection));
  expect(result.current.protocolInfo?.vault).toBe(vault);
});
