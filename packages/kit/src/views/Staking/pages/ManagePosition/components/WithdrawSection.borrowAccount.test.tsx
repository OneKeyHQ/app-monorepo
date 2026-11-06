/** @jest-environment jsdom */
/* eslint-disable import/first */

const mockRisk = jest.fn<Promise<boolean>, [unknown]>();
const mockAddress = jest.fn<Promise<string>, [unknown]>();
const mockBuild = jest.fn<Promise<void>, [unknown]>();
const mockConfirm = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccountAddressForApi: (p: unknown) => mockAddress(p) },
    serviceStaking: {
      borrowBuildWithdrawTransaction: (p: unknown) => mockBuild(p),
      borrowBuildRepayTransaction: (p: unknown) => mockBuild(p),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _fn: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) => ({ result: options?.initResult, isLoading: false }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: jest.fn() }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog',
  () => ({ useEarnRiskWarningGate: () => mockRisk }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/hooks/borrowConfirmationTask',
  () => ({
    runBorrowConfirmationTask: async ({
      build,
    }: {
      build: () => Promise<void>;
    }) => {
      await build();
      return true;
    },
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/hooks/borrowTransactionUtils',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks',
  () => {
    const actual = jest.requireActual<
      typeof import('@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowWithdrawRepayHooks')
    >(
      '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowWithdrawRepayHooks',
    );
    return {
      ...actual,
      useUniversalBorrowRepayWithCollateral: () => jest.fn(),
    };
  },
);
jest.mock('@onekeyhq/kit/src/views/Borrow/components/ManagePosition', () => ({
  ManagePosition: ({ onConfirm }: { onConfirm: unknown }) => {
    mockConfirm(onConfirm);
    return null;
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/components/BorrowRepayPosition',
  () => ({
    BorrowRepayPosition: ({
      onWalletConfirm,
    }: {
      onWalletConfirm: unknown;
    }) => {
      mockConfirm(onWalletConfirm);
      return null;
    },
  }),
);
jest.mock('../../../components/EarnProtocolForms/Withdraw', () => ({
  EarnWithdrawForm: () => null,
}));
jest.mock('../../../hooks/useBorrowApiParams', () => ({
  useBorrowApiParams: (params: unknown) => ({
    isBorrow: true,
    borrowApiParams: params,
  }),
}));
jest.mock('../../../hooks/useEarnWithdrawAssets', () => ({
  useEarnWithdrawAssets: () => ({ assets: [], status: 'idle' }),
}));
jest.mock('../../../hooks/useIsPendleProvider', () => ({
  useIsPendleProvider: () => false,
}));
jest.mock('../../../hooks/useUniversalHooks', () => ({
  useUniversalWithdraw: () => jest.fn(),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

import { act, render } from '@testing-library/react';

import type {
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { WithdrawSection } from './WithdrawSection';

const protocol = {
  provider: 'aave',
  providerDetail: { name: 'Aave', logoURI: '' },
  networkId: 'evm--1',
  symbol: 'ETH',
  vault: 'vault',
  stakeTag: '',
  earnAccount: {
    accountId: 'account-1',
    networkId: 'evm--1',
    accountAddress: '0xaaa',
  },
} as IProtocolInfo;
const tokenInfo = {
  token: { symbol: 'ETH', address: '', isNative: true, decimals: 18 },
  balanceParsed: '1',
  price: '1',
} as IEarnTokenInfo;

describe.each(['withdraw', 'repay'] as const)(
  'Borrow %s account scope',
  (action) => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockAddress.mockResolvedValue('0xaaa');
      mockBuild.mockResolvedValue();
    });
    it.each([
      ['page account', protocol],
      [
        'legacy page without an account',
        { ...protocol, earnAccount: undefined },
      ],
    ])('builds normally for %s', async (_case, pageProtocol) => {
      mockRisk.mockResolvedValue(true);
      render(
        <WithdrawSection
          accountId="account-1"
          networkId="evm--1"
          tokenInfo={tokenInfo}
          protocolInfo={pageProtocol}
          useBorrowApi
          borrowAction={action}
          borrowMarketAddress="market"
          borrowReserveAddress="reserve"
        />,
      );
      const confirm = mockConfirm.mock.lastCall?.[0] as (params: {
        amount: string;
      }) => Promise<boolean>;
      await act(async () => {
        await expect(confirm({ amount: '1' })).resolves.toBe(true);
      });
      expect(mockBuild).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedAccountAddress: '0xaaa',
          accountId: 'account-1',
          networkId: 'evm--1',
          amount: '1',
        }),
      );
    });
    it('rejects an account switch during the risk gate before building', async () => {
      let acceptRisk: (value: boolean) => void = () => undefined;
      mockRisk.mockReturnValue(
        new Promise<boolean>((resolve) => {
          acceptRisk = resolve;
        }),
      );
      render(
        <WithdrawSection
          accountId="account-1"
          networkId="evm--1"
          tokenInfo={tokenInfo}
          protocolInfo={protocol}
          useBorrowApi
          borrowAction={action}
          borrowMarketAddress="market"
          borrowReserveAddress="reserve"
        />,
      );
      const confirm = mockConfirm.mock.lastCall?.[0] as (params: {
        amount: string;
      }) => Promise<boolean>;
      let submission: Promise<boolean> | undefined;
      act(() => {
        submission = confirm({ amount: '1' });
      });
      mockAddress.mockResolvedValue('0xbbb');
      await act(async () => {
        acceptRisk(true);
        await expect(submission).rejects.toThrow(
          'Borrow transaction confirmation expired',
        );
      });
      expect(mockBuild).not.toHaveBeenCalled();
    });
  },
);
