/* eslint-disable import/first */

jest.mock('react-intl', () => ({ useIntl: () => ({ locale: 'en' }) }));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAccount: jest.fn(),
      getManagePage: jest.fn(),
      getProtocolList: jest.fn(),
      getStakingConfigs: jest.fn(),
    },
  },
}));
jest.mock('../../../utils/utils', () => ({
  buildLocalTxStatusSyncId: () => 'test-tag',
}));

import { renderHook } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
      depositsEnabled: true,
      earnAccount: { accountAddress: '0xAccount' },
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
it('loads a disabled position from the registered catalog and disables only deposits', async () => {
  const staking = jest.mocked(backgroundApiProxy.serviceStaking);
  staking.getEarnAccount.mockResolvedValue({
    accountAddress: vault,
  } as NonNullable<Awaited<ReturnType<typeof staking.getEarnAccount>>>);
  staking.getManagePage.mockResolvedValue({
    deposit: { disabled: false },
    withdraw: { disabled: false },
  } as Awaited<ReturnType<typeof staking.getManagePage>>);
  staking.getProtocolList.mockImplementation(
    async ({ includeWithdrawOnly, skipStakingConfigFilter }) =>
      includeWithdrawOnly && skipStakingConfigFilter
        ? ([
            {
              network: { networkId: params.networkId },
              provider: { name: params.provider, vault },
            },
          ] as Awaited<ReturnType<typeof staking.getProtocolList>>)
        : [],
  );
  staking.getStakingConfigs.mockResolvedValue({ enabled: false } as NonNullable<
    Awaited<ReturnType<typeof staking.getStakingConfigs>>
  >);
  const hook = jest.mocked(usePromiseResult);
  hook.mockReturnValue(response());
  const { result, rerender } = renderHook(() => useManagePage(params));
  const call = hook.mock.lastCall;
  if (!call)
    throw new OneKeyLocalError('Manage-page loader was not registered');
  const fetched = await call[0]();
  hook.mockReturnValue({ ...response(), result: fetched });
  rerender({});
  expect(result.current.protocolInfo?.vault).toBe(vault);
  expect(result.current.depositDisabled).toBe(true);
  expect(result.current.withdrawDisabled).toBe(false);
});

it('does not expose another account while a new selection is loading', () => {
  jest.mocked(usePromiseResult).mockReturnValue(response());
  const { result, rerender } = renderHook(
    (selection: typeof params) => useManagePage(selection),
    { initialProps: params },
  );
  expect(result.current.earnAccount?.accountAddress).toBe('0xAccount');
  rerender({ ...params, accountId: 'account-2' });
  expect(result.current.earnAccount).toBeUndefined();
  expect(result.current.isStaleData).toBe(true);
});

it('does not require an Earn protocol catalog for a Borrow manage page', () => {
  const selection = { ...params, type: EManagePositionType.Borrow };
  const borrowed = response(selection);
  jest.mocked(usePromiseResult).mockReturnValue({
    ...borrowed,
    result: {
      requestKey: buildManagePageRequestKey(selection),
      earnAccount: { accountAddress: '0xAccount' },
      protocolList: undefined,
      managePageData: {
        borrow: {
          data: {
            token: { info: { address: vault }, price: '1' },
            balance: '2',
          },
        },
      },
    },
  } as ReturnType<typeof usePromiseResult>);
  const { result } = renderHook(() => useManagePage(selection));
  expect(result.current.tokenInfo?.token.address).toBe(vault);
  expect(result.current.protocolInfo?.vault).toBe(vault);
});
it('keeps the registered vault when the URL uses checksum casing', () => {
  const selection = { ...params, vault: vault.toUpperCase() };
  jest.mocked(usePromiseResult).mockReturnValue(response(selection));
  const { result } = renderHook(() => useManagePage(selection));
  expect(result.current.protocolInfo?.vault).toBe(vault);
});
