// cspell:ignore RLUSD
import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  BINANCE_DEPOSIT_SIGN_ONLY_TEXT,
  runBinanceDepositSendFlow,
} from './sendFlow';

import type { IBinanceDepositSendFlowParams } from './sendFlow';
import type { IntlShape } from 'react-intl';

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
  },
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: { getDevSetting: jest.fn() },
    serviceToken: {
      getToken: jest.fn(),
      getNativeToken: jest.fn(),
      fetchTokensDetails: jest.fn(),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn(),
      getNetworkSafe: jest.fn(),
    },
    serviceSend: { validateMemo: jest.fn() },
    serviceAccountProfile: { queryAddress: jest.fn() },
    serviceBinanceDeposit: {
      revalidateBeforeSign: jest.fn(),
      submitReport: jest.fn(),
    },
  },
}));

jest.mock(
  '../../components/AddressInput/confirmCexDepositIfUnsupported',
  () => ({
    confirmCexDepositIfUnsupported: jest.fn(),
  }),
);

jest.mock(
  '../SignatureConfirm/components/SimilarAddressDialog/SimilarAddressDialog',
  () => ({
    showSimilarAddressDialog: jest.fn(),
  }),
);

type IMockedApi = {
  serviceDevSetting: { getDevSetting: jest.Mock };
  serviceToken: {
    getToken: jest.Mock;
    getNativeToken: jest.Mock;
    fetchTokensDetails: jest.Mock;
  };
  serviceNetwork: { getVaultSettings: jest.Mock; getNetworkSafe: jest.Mock };
  serviceSend: { validateMemo: jest.Mock };
  serviceAccountProfile: { queryAddress: jest.Mock };
  serviceBinanceDeposit: {
    revalidateBeforeSign: jest.Mock;
    submitReport: jest.Mock;
  };
};

const api = (
  jest.requireMock('../../background/instance/backgroundApiProxy') as {
    default: IMockedApi;
  }
).default;
const mockedToastError = (
  jest.requireMock('@onekeyhq/components') as {
    Toast: { error: jest.Mock };
  }
).Toast.error;
const mockedConfirmCex = (
  jest.requireMock(
    '../../components/AddressInput/confirmCexDepositIfUnsupported',
  ) as { confirmCexDepositIfUnsupported: jest.Mock }
).confirmCexDepositIfUnsupported;
const mockedSimilarDialog = (
  jest.requireMock(
    '../SignatureConfirm/components/SimilarAddressDialog/SimilarAddressDialog',
  ) as { showSimilarAddressDialog: jest.Mock }
).showSimilarAddressDialog;

// The exchange deposit warning that receives it is mocked.
const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as unknown as IntlShape;

type INavigationParams = Parameters<
  IBinanceDepositSendFlowParams['navigationToTxConfirm']
>[0];

const NETWORK_ID = 'evm--56';
const ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
const SENDER = '0x1111111111111111111111111111111111111111';
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
const DEPOSIT_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const TX_HASH = `0x${'ab'.repeat(32)}`;

const usdtToken: IToken = {
  decimals: 18,
  name: 'Tether USD',
  symbol: 'USDT',
  address: USDT_CONTRACT.toLowerCase(),
  isNative: false,
};

const nativeToken: IToken = {
  decimals: 18,
  name: 'BNB',
  symbol: 'BNB',
  address: '',
  isNative: true,
};

function buildDestination(
  patch: Partial<IBinanceDepositAuthorizedDestination> = {},
): IBinanceDepositAuthorizedDestination {
  return {
    networkId: NETWORK_ID,
    binanceNetwork: 'BSC',
    cryptoCurrency: 'USDT',
    contractAddress: USDT_CONTRACT,
    minAmount: '1',
    address: DEPOSIT_ADDRESS,
    authorizedAt: 1_700_000_000_000,
    ...patch,
  };
}

function buildSession(
  patch: Partial<IBinanceDepositSessionSnapshot> = {},
): IBinanceDepositSessionSnapshot {
  return {
    localId: 'local-id-0001',
    sessionId: 'c'.repeat(64),
    accountId: ACCOUNT_ID,
    senderAddress: SENDER,
    networkId: NETWORK_ID,
    cryptoCurrency: 'USDT',
    contractAddress: USDT_CONTRACT,
    status: EBinanceDepositSessionStatus.AUTHORIZED,
    destination: buildDestination(),
    createdAt: 1,
    updatedAt: 1,
    awaitingReturn: false,
    hasPendingNonce: false,
    bindInFlight: false,
    sessionIdMasked: 'cccccccc…',
    endpointMismatch: false,
    ...patch,
  };
}

function buildTokenDetail(info: IToken, balanceParsed = '100') {
  return { info, balance: '0', balanceParsed, fiatValue: '0', price: 1 };
}

function buildSuccessData(
  patch: { txid?: unknown; owner?: unknown } = {},
): ISendTxOnSuccessData[] {
  return [
    {
      signedTx: { txid: 'txid' in patch ? patch.txid : TX_HASH },
      decodedTx: { owner: 'owner' in patch ? patch.owner : SENDER },
    },
  ] as unknown as ISendTxOnSuccessData[];
}

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function setup(overrides: Partial<IBinanceDepositSendFlowParams> = {}) {
  const navigationToTxConfirm = jest.fn<Promise<void>, [INavigationParams]>(
    async () => undefined,
  );
  const setNotice = jest.fn();
  const logSendResult = jest.fn();
  const onSent = jest.fn();
  const refreshState = jest.fn(async () => undefined);
  const params: IBinanceDepositSendFlowParams = {
    session: buildSession(),
    amountInput: '5',
    requiresAddressTag: false,
    isAssetListReady: true,
    isSignOnlyEnabled: false,
    isSignOnlyEnabledNow: () => false,
    hasSentLocally: false,
    intl,
    navigationToTxConfirm,
    onSent,
    setNotice,
    logSendResult,
    refreshState,
    ...overrides,
  };
  return {
    params,
    navigationToTxConfirm,
    setNotice,
    logSendResult,
    onSent,
    refreshState,
    run: () => runBinanceDepositSendFlow(params),
    getConfirmParams: () => {
      expect(navigationToTxConfirm).toHaveBeenCalledTimes(1);
      return navigationToTxConfirm.mock.calls[0][0];
    },
  };
}

function expectBlocked(
  context: ReturnType<typeof setup>,
  reason: string,
): void {
  expect(context.navigationToTxConfirm).not.toHaveBeenCalled();
  expect(context.logSendResult).toHaveBeenCalledWith(
    expect.objectContaining({ result: 'blocked', reason }),
  );
  expect(context.setNotice).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'critical' }),
  );
  expect(mockedToastError).toHaveBeenCalledTimes(1);
}

describe('runBinanceDepositSendFlow', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    api.serviceDevSetting.getDevSetting.mockResolvedValue({
      enabled: true,
      settings: {},
    });
    api.serviceToken.getToken.mockResolvedValue(usdtToken);
    api.serviceToken.getNativeToken.mockResolvedValue(nativeToken);
    api.serviceToken.fetchTokensDetails.mockResolvedValue([
      buildTokenDetail(usdtToken),
    ]);
    api.serviceNetwork.getVaultSettings.mockResolvedValue({
      withMemo: false,
      isSingleToken: false,
    });
    api.serviceNetwork.getNetworkSafe.mockResolvedValue({ name: 'BNB Chain' });
    api.serviceSend.validateMemo.mockResolvedValue({ isValid: true });
    api.serviceAccountProfile.queryAddress.mockResolvedValue({
      validStatus: 'valid',
      validAddress: DEPOSIT_ADDRESS,
      isContract: false,
    });
    api.serviceBinanceDeposit.revalidateBeforeSign.mockResolvedValue(undefined);
    api.serviceBinanceDeposit.submitReport.mockResolvedValue(
      buildSession({
        report: {
          txHash: TX_HASH,
          senderAddress: SENDER,
          status: 'CONFIRMED',
          attempts: 1,
          updatedAt: 2,
        },
      }),
    );
    mockedConfirmCex.mockResolvedValue({
      canProceed: true,
      hasAcknowledgedWarning: false,
    });
    mockedSimilarDialog.mockResolvedValue(undefined);
  });

  describe('session state', () => {
    it.each([
      ['is not authorized', { status: EBinanceDepositSessionStatus.INIT }],
      ['has no destination', { destination: undefined }],
      ['is locally closed', { localClosedReason: 'abandoned' }],
    ])('blocks a session that %s', async (_name, patch) => {
      const context = setup({ session: buildSession(patch) });
      await context.run();
      expectBlocked(context, 'not_authorized');
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
      expect(api.serviceAccountProfile.queryAddress).not.toHaveBeenCalled();
    });

    it('blocks a session that already has a report', async () => {
      const context = setup({
        session: buildSession({
          report: {
            txHash: TX_HASH,
            senderAddress: SENDER,
            status: 'FAILED',
            attempts: 1,
            updatedAt: 2,
          },
        }),
      });
      await context.run();
      expectBlocked(context, 'already_sent');
    });

    it('blocks a session this page already sent for', async () => {
      const context = setup({ hasSentLocally: true });
      await context.run();
      expectBlocked(context, 'already_sent');
    });

    it('blocks a destination on another network', async () => {
      const context = setup({
        session: buildSession({
          destination: buildDestination({ networkId: 'evm--1' }),
        }),
      });
      await context.run();
      expectBlocked(context, 'destination_mismatch');
    });

    it('blocks a session whose earlier signing attempt was not acknowledged', async () => {
      const context = setup({
        session: buildSession({ sendAttemptedAt: 1_700_000_100_000 }),
      });
      await context.run();
      expectBlocked(context, 'send_attempt_unacknowledged');
      const notice = context.setNotice.mock.calls.at(-1)?.[0] as {
        text: string;
      };
      expect(notice.text).toContain('account history');
      expect(api.serviceDevSetting.getDevSetting).not.toHaveBeenCalled();
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).not.toHaveBeenCalled();
    });
  });

  describe('sender account', () => {
    it.each([
      [
        'an external (WalletConnect) account',
        'external--60--0x1111111111111111111111111111111111111111',
      ],
      [
        'a watch-only account',
        'watching--60--0x1111111111111111111111111111111111111111',
      ],
    ])('blocks %s before any lookup', async (_name, accountId) => {
      const context = setup({ session: buildSession({ accountId }) });
      await context.run();
      expectBlocked(context, 'sender_account_unsupported');
      const notice = context.setNotice.mock.calls.at(-1)?.[0] as {
        text: string;
      };
      expect(notice.text).toContain('signs and broadcasts');
      expect(api.serviceDevSetting.getDevSetting).not.toHaveBeenCalled();
      expect(api.serviceNetwork.getVaultSettings).not.toHaveBeenCalled();
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
      expect(api.serviceAccountProfile.queryAddress).not.toHaveBeenCalled();
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).not.toHaveBeenCalled();
    });

    it.each([
      ['an HD account', ACCOUNT_ID],
      [
        'a hardware account',
        "hw-da2fb055-f3c8-4b55-922e-a04a6fea29cf--m/44'/60'/0'/0/0",
      ],
      [
        'an imported account',
        'imported--60--0x1111111111111111111111111111111111111111',
      ],
    ])('lets %s through', async (_name, accountId) => {
      const context = setup({ session: buildSession({ accountId }) });
      await context.run();
      expect(context.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('sign-only switch', () => {
    it('blocks when the page already sees the switch on', async () => {
      const context = setup({ isSignOnlyEnabled: true });
      await context.run();
      expectBlocked(context, 'sign_only');
      expect(context.setNotice).toHaveBeenCalledWith({
        type: 'critical',
        text: BINANCE_DEPOSIT_SIGN_ONLY_TEXT,
      });
    });

    it('blocks when the background reports the switch on', async () => {
      api.serviceDevSetting.getDevSetting.mockResolvedValue({
        enabled: true,
        settings: { alwaysSignOnlySendTx: true },
      });
      const context = setup();
      await context.run();
      expectBlocked(context, 'sign_only');
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
    });

    it('ignores the stored switch while developer mode is off', async () => {
      api.serviceDevSetting.getDevSetting.mockResolvedValue({
        enabled: false,
        settings: { alwaysSignOnlySendTx: true },
      });
      const context = setup();
      await context.run();
      expect(context.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('amount', () => {
    it('blocks an amount below the minimum before any lookup', async () => {
      const context = setup({ amountInput: '0.99' });
      await context.run();
      expectBlocked(context, 'amount_below_min');
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).not.toHaveBeenCalled();
    });

    it('blocks when the minimum cannot be read', async () => {
      const context = setup({
        session: buildSession({
          destination: buildDestination({ minAmount: 'n/a' }),
        }),
      });
      await context.run();
      expectBlocked(context, 'amount_min_amount_invalid');
    });

    it('blocks a malformed amount', async () => {
      const context = setup({ amountInput: '1e3' });
      await context.run();
      expectBlocked(context, 'amount_malformed');
    });

    it('blocks an amount above the fresh balance', async () => {
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail(usdtToken, '4.99'),
      ]);
      const context = setup();
      await context.run();
      expectBlocked(context, 'amount_insufficient_balance');
      expect(api.serviceAccountProfile.queryAddress).not.toHaveBeenCalled();
    });

    it('blocks below the deposit dust when the destination sets no minimum', async () => {
      const context = setup({
        session: buildSession({
          destination: buildDestination({ minAmount: undefined }),
        }),
        depositDust: '10',
      });
      await context.run();
      expectBlocked(context, 'amount_below_min');
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
    });

    it('raises a lower destination minimum to the deposit dust', async () => {
      const context = setup({ amountInput: '5', depositDust: '5.01' });
      await context.run();
      expectBlocked(context, 'amount_below_min');
    });

    it('never lowers the destination minimum to the deposit dust', async () => {
      const context = setup({ amountInput: '0.99', depositDust: '0.001' });
      await context.run();
      expectBlocked(context, 'amount_below_min');
    });

    it('accepts an amount equal to the deposit dust', async () => {
      const context = setup({
        amountInput: '5',
        session: buildSession({
          destination: buildDestination({ minAmount: undefined }),
        }),
        depositDust: '5',
      });
      await context.run();
      expect(context.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    });

    it('has no floor when neither the destination nor the loaded asset list sets one', async () => {
      const context = setup({
        amountInput: '0.000001',
        session: buildSession({
          destination: buildDestination({ minAmount: undefined }),
        }),
        depositDust: undefined,
        isAssetListReady: true,
      });
      await context.run();
      expect(context.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['carries no minimum', undefined],
      ['carries an empty minimum', ''],
      ['carries a minimum of zero', '0'],
    ])(
      'blocks before any lookup when the asset list is not ready and the destination %s',
      async (_name, minAmount) => {
        const context = setup({
          // Far above any plausible minimum: the amount is not the point.
          amountInput: '1000',
          session: buildSession({
            destination: buildDestination({ minAmount }),
          }),
          depositDust: undefined,
          isAssetListReady: false,
        });
        await context.run();

        expectBlocked(context, 'amount_min_amount_unknown');
        const notice = context.setNotice.mock.calls.at(-1)?.[0] as {
          text: string;
        };
        expect(notice.text).toContain('asset list');
        expect(notice.text).toContain('minimum deposit amount is unknown');
        expect(notice.text).toContain('Reload');
        expect(api.serviceNetwork.getVaultSettings).not.toHaveBeenCalled();
        expect(api.serviceToken.getToken).not.toHaveBeenCalled();
        expect(api.serviceAccountProfile.queryAddress).not.toHaveBeenCalled();
        expect(
          api.serviceBinanceDeposit.revalidateBeforeSign,
        ).not.toHaveBeenCalled();
      },
    );

    it('does not rely on a deposit dust handed over without the asset list', async () => {
      const context = setup({
        amountInput: '1000',
        session: buildSession({
          destination: buildDestination({ minAmount: undefined }),
        }),
        depositDust: '5',
        isAssetListReady: false,
      });
      await context.run();
      expectBlocked(context, 'amount_min_amount_unknown');
    });

    it('still sends with the minimum of the destination while the asset list is not ready', async () => {
      const context = setup({
        amountInput: '5',
        depositDust: undefined,
        isAssetListReady: false,
      });
      await context.run();
      expect(context.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    });

    it('keeps the minimum of the destination a hard floor while the asset list is not ready', async () => {
      const context = setup({
        amountInput: '0.99',
        depositDust: undefined,
        isAssetListReady: false,
      });
      await context.run();
      expectBlocked(context, 'amount_below_min');
    });

    it('blocks more decimals than the token has', async () => {
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail({ ...usdtToken, decimals: 2 }),
      ]);
      const context = setup({ amountInput: '5.123' });
      await context.run();
      expectBlocked(context, 'amount_too_many_decimals');
    });
  });

  describe('token', () => {
    it('never falls back to the native coin for a missing contract token', async () => {
      api.serviceToken.getToken.mockResolvedValue(null);
      const context = setup();
      await context.run();
      expectBlocked(context, 'token_unavailable');
      expect(api.serviceToken.getToken).toHaveBeenCalledWith({
        accountId: ACCOUNT_ID,
        networkId: NETWORK_ID,
        tokenIdOnNetwork: USDT_CONTRACT,
      });
      expect(api.serviceToken.getNativeToken).not.toHaveBeenCalled();
    });

    it('blocks when a contract asset resolves to a native token', async () => {
      api.serviceToken.getToken.mockResolvedValue(nativeToken);
      const context = setup();
      await context.run();
      expectBlocked(context, 'token_mismatch');
    });

    it('blocks when the resolved token has another contract address', async () => {
      api.serviceToken.getToken.mockResolvedValue({
        ...usdtToken,
        address: '0x2222222222222222222222222222222222222222',
      });
      const context = setup();
      await context.run();
      expectBlocked(context, 'token_mismatch');
    });

    it('blocks when the fresh read does not contain the token', async () => {
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail(nativeToken),
      ]);
      const context = setup();
      await context.run();
      expectBlocked(context, 'token_unavailable');
    });

    it('blocks a token with a scaling balance multiplier', async () => {
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail({ ...usdtToken, balanceMultiplier: '1.5' }),
      ]);
      const context = setup();
      await context.run();
      expectBlocked(context, 'token_scaled_unsupported');
    });

    it('uses the native token when the destination has no contract', async () => {
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail(nativeToken),
      ]);
      const context = setup({
        session: buildSession({
          cryptoCurrency: 'BNB',
          contractAddress: undefined,
          destination: buildDestination({
            cryptoCurrency: 'BNB',
            contractAddress: undefined,
          }),
        }),
      });
      await context.run();
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
      expect(api.serviceToken.getNativeToken).toHaveBeenCalledWith({
        accountId: ACCOUNT_ID,
        networkId: NETWORK_ID,
      });
      const confirmParams = context.getConfirmParams();
      expect(confirmParams.transfersInfo?.[0].tokenInfo?.isNative).toBe(true);
    });

    it('blocks a native asset whose symbol is not the coin of the network', async () => {
      // An asset the upstream lists without a contract on xrp--0, while the
      // coin the app would send there is XRP.
      api.serviceToken.getNativeToken.mockResolvedValue({
        ...nativeToken,
        symbol: 'XRP',
        decimals: 6,
      });
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail({ ...nativeToken, symbol: 'XRP', decimals: 6 }),
      ]);
      api.serviceNetwork.getVaultSettings.mockResolvedValue({
        withMemo: true,
        isSingleToken: true,
      });
      const context = setup({
        session: buildSession({
          networkId: 'xrp--0',
          cryptoCurrency: 'SOLO',
          contractAddress: undefined,
          destination: buildDestination({
            networkId: 'xrp--0',
            binanceNetwork: 'XRP',
            cryptoCurrency: 'SOLO',
            contractAddress: undefined,
            address: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh',
            addressTag: '104857600',
          }),
        }),
      });
      await context.run();
      expectBlocked(context, 'token_mismatch');
      expect(api.serviceAccountProfile.queryAddress).not.toHaveBeenCalled();
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).not.toHaveBeenCalled();
    });

    it('compares the native symbol ignoring case and surrounding spaces', async () => {
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail({ ...nativeToken, symbol: ' bnb ' }),
      ]);
      const context = setup({
        session: buildSession({
          cryptoCurrency: 'BNB',
          contractAddress: undefined,
          destination: buildDestination({
            cryptoCurrency: 'BNB',
            contractAddress: undefined,
          }),
        }),
      });
      await context.run();
      expect(context.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    });

    it('blocks a contract asset on a network that only sends its native coin', async () => {
      // xrp--0 / RLUSD: the listed contract is the issuer address, and the
      // XRP vault builds a native payment whatever token it is handed.
      api.serviceNetwork.getVaultSettings.mockResolvedValue({
        withMemo: true,
        isSingleToken: true,
      });
      const issuer = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De';
      // Even a token API that knows the issuer does not get a say.
      api.serviceToken.getToken.mockResolvedValue({
        ...usdtToken,
        symbol: 'RLUSD',
        address: issuer,
      });
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail({ ...usdtToken, symbol: 'RLUSD', address: issuer }),
      ]);
      const context = setup({
        session: buildSession({
          networkId: 'xrp--0',
          cryptoCurrency: 'RLUSD',
          contractAddress: issuer,
          destination: buildDestination({
            networkId: 'xrp--0',
            binanceNetwork: 'XRP',
            cryptoCurrency: 'RLUSD',
            contractAddress: issuer,
            address: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh',
            addressTag: '104857600',
          }),
        }),
      });
      await context.run();
      expectBlocked(context, 'token_unsupported');
      expect(api.serviceNetwork.getVaultSettings).toHaveBeenCalledWith({
        networkId: 'xrp--0',
      });
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
      expect(api.serviceToken.getNativeToken).not.toHaveBeenCalled();
    });

    it.each([
      '0x0000000000000000000000000000000000001010',
      ' 0X0000000000000000000000000000000000001010 '.toLowerCase(),
      '0x0000000000000000000000000000000000001010'.toUpperCase(),
    ])(
      'blocks the native coin of evm--137 listed under the placeholder contract %j',
      async (contractAddress) => {
        const context = setup({
          session: buildSession({
            networkId: 'evm--137',
            cryptoCurrency: 'POL',
            contractAddress,
            destination: buildDestination({
              networkId: 'evm--137',
              binanceNetwork: 'MATIC',
              cryptoCurrency: 'POL',
              contractAddress,
            }),
          }),
        });
        await context.run();
        expectBlocked(context, 'native_placeholder_contract');
        expect(api.serviceToken.getToken).not.toHaveBeenCalled();
        expect(api.serviceToken.getNativeToken).not.toHaveBeenCalled();
      },
    );

    it('leaves the same contract address alone on another network', async () => {
      const placeholder = '0x0000000000000000000000000000000000001010';
      api.serviceToken.getToken.mockResolvedValue({
        ...usdtToken,
        address: placeholder,
      });
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail({ ...usdtToken, address: placeholder }),
      ]);
      const context = setup({
        session: buildSession({
          contractAddress: placeholder,
          destination: buildDestination({ contractAddress: placeholder }),
        }),
      });
      await context.run();
      expect(context.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    });

    it('blocks when the capabilities of the network cannot be read', async () => {
      api.serviceNetwork.getVaultSettings.mockRejectedValue(
        new Error('unknown network'),
      );
      const context = setup();
      await context.run();
      expectBlocked(context, 'preflight_error');
      expect(api.serviceToken.getToken).not.toHaveBeenCalled();
    });

    it('requires the fresh read of a native asset to be the native coin', async () => {
      const nativeSession = buildSession({
        cryptoCurrency: 'BNB',
        contractAddress: undefined,
        destination: buildDestination({
          cryptoCurrency: 'BNB',
          contractAddress: undefined,
        }),
      });
      // A cached record without the flag is fine as long as the fresh read
      // confirms it.
      api.serviceToken.getNativeToken.mockResolvedValue({
        ...nativeToken,
        isNative: undefined,
      });
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail(nativeToken),
      ]);
      const accepted = setup({ session: nativeSession });
      await accepted.run();
      expect(accepted.navigationToTxConfirm).toHaveBeenCalledTimes(1);

      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail(usdtToken),
      ]);
      const rejected = setup({ session: nativeSession });
      await rejected.run();
      expect(rejected.navigationToTxConfirm).not.toHaveBeenCalled();
      expect(rejected.logSendResult).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'blocked',
          reason: 'token_unavailable',
        }),
      );
    });
  });

  describe('tag', () => {
    const xrpSession = (addressTag?: string) =>
      buildSession({
        networkId: 'xrp--0',
        cryptoCurrency: 'XRP',
        contractAddress: undefined,
        destination: buildDestination({
          networkId: 'xrp--0',
          binanceNetwork: 'XRP',
          cryptoCurrency: 'XRP',
          contractAddress: undefined,
          address: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh',
          addressTag,
        }),
      });

    beforeEach(() => {
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail({ ...nativeToken, symbol: 'XRP', decimals: 6 }),
      ]);
      // As the XRP vault declares it: memo support, and native transfers
      // only. The native coin itself can still be deposited there.
      api.serviceNetwork.getVaultSettings.mockResolvedValue({
        withMemo: true,
        numericOnlyMemo: true,
        memoMaxLength: 10,
        isSingleToken: true,
      });
      api.serviceAccountProfile.queryAddress.mockResolvedValue({
        validStatus: 'valid',
        validAddress: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh',
      });
    });

    it('passes the tag verbatim to the transfer and the confirm payload', async () => {
      const context = setup({
        session: xrpSession('104857600'),
        requiresAddressTag: true,
      });
      await context.run();
      const confirmParams = context.getConfirmParams();
      expect(confirmParams.transfersInfo?.[0].memo).toBe('104857600');
      expect(confirmParams.transferPayload?.memo).toBe('104857600');
      expect(api.serviceSend.validateMemo).toHaveBeenCalledWith(
        expect.objectContaining({ networkId: 'xrp--0', memo: '104857600' }),
      );
    });

    it('blocks a tag the network memo check rejects', async () => {
      api.serviceSend.validateMemo.mockResolvedValue({ isValid: false });
      const context = setup({ session: xrpSession('104857600') });
      await context.run();
      expectBlocked(context, 'tag_invalid');
    });

    it.each(['12a', ' 12', '12345678901'])(
      'blocks the malformed tag %j',
      async (tag) => {
        const context = setup({ session: xrpSession(tag) });
        await context.run();
        expectBlocked(context, 'tag_invalid');
      },
    );

    it('blocks a missing tag when the asset requires one', async () => {
      const context = setup({
        session: xrpSession(undefined),
        requiresAddressTag: true,
      });
      await context.run();
      expectBlocked(context, 'tag_missing');
    });

    it('blocks a missing tag on a memo network when the asset list is unknown', async () => {
      const context = setup({
        session: xrpSession(undefined),
        requiresAddressTag: undefined,
      });
      await context.run();
      expectBlocked(context, 'tag_missing');
    });

    it('blocks a tag on a network without memo support', async () => {
      api.serviceToken.fetchTokensDetails.mockResolvedValue([
        buildTokenDetail(usdtToken),
      ]);
      api.serviceNetwork.getVaultSettings.mockResolvedValue({
        withMemo: false,
        isSingleToken: false,
      });
      const context = setup({
        session: buildSession({
          destination: buildDestination({ addressTag: '12345' }),
        }),
      });
      await context.run();
      expectBlocked(context, 'tag_unsupported');
    });
  });

  describe('recipient check', () => {
    it('runs the Send amount page check, allowlist included', async () => {
      const context = setup();
      await context.run();
      expect(api.serviceAccountProfile.queryAddress).toHaveBeenCalledWith({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
        address: DEPOSIT_ADDRESS,
        enableAddressBook: true,
        enableAddressContract: true,
        enableVerifySendFundToSelf: true,
        enableWalletName: true,
        enableAllowListValidation: true,
        ignoreSimilarAddressInAddressBook: true,
        enableCheckSimilarAddressInAddressBook: true,
        tokenAddress: usdtToken.address,
      });
    });

    it.each([
      'address-not-allowlist',
      'invalid',
      'prohibit-send-to-self',
      'unknown',
    ])('blocks when the check returns %s', async (validStatus) => {
      api.serviceAccountProfile.queryAddress.mockResolvedValue({ validStatus });
      const context = setup();
      await context.run();
      expectBlocked(context, `address_${validStatus}`);
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).not.toHaveBeenCalled();
    });

    it('blocks when the check returns no status', async () => {
      api.serviceAccountProfile.queryAddress.mockResolvedValue({});
      const context = setup();
      await context.run();
      expectBlocked(context, 'address_unknown');
    });

    it('blocks instead of replacing the address with a different local form', async () => {
      api.serviceAccountProfile.queryAddress.mockResolvedValue({
        validStatus: 'valid',
        validAddress: '0x3333333333333333333333333333333333333333',
      });
      const context = setup();
      await context.run();
      expectBlocked(context, 'address_form_differs');
    });

    it('stops quietly when the similar-address warning is declined', async () => {
      api.serviceAccountProfile.queryAddress.mockResolvedValue({
        validStatus: 'valid',
        validAddress: DEPOSIT_ADDRESS,
        similarAddress: '0x000000000000000000000000000000000000dEaF',
      });
      mockedSimilarDialog.mockRejectedValue(new Error('declined'));
      const context = setup();
      await context.run();
      expect(context.navigationToTxConfirm).not.toHaveBeenCalled();
      expect(context.logSendResult).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'cancel',
          reason: 'similar_address_declined',
        }),
      );
      expect(mockedSimilarDialog).toHaveBeenCalledWith({
        similarAddress: '0x000000000000000000000000000000000000dEaF',
        currentAddress: DEPOSIT_ADDRESS,
      });
    });

    it('stops quietly when the exchange deposit warning is declined', async () => {
      mockedConfirmCex.mockResolvedValue({
        canProceed: false,
        hasAcknowledgedWarning: false,
      });
      const context = setup();
      await context.run();
      expect(context.navigationToTxConfirm).not.toHaveBeenCalled();
      expect(context.logSendResult).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'cancel',
          reason: 'cex_warning_declined',
        }),
      );
    });
  });

  describe('re-verification before the confirm page', () => {
    it('does not open the confirm page when it fails', async () => {
      api.serviceBinanceDeposit.revalidateBeforeSign.mockRejectedValue({
        code: EBinanceDepositLocalErrorCode.RevalidateFailed,
        message: 'not shown',
      });
      const context = setup();
      await context.run();
      expect(context.navigationToTxConfirm).not.toHaveBeenCalled();
      expect(context.logSendResult).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'blocked',
          reason: 'revalidate_failed',
        }),
      );
      // The background error brings its own toast.
      expect(mockedToastError).not.toHaveBeenCalled();
      const notice = context.setNotice.mock.calls.at(-1)?.[0] as {
        text: string;
      };
      expect(notice.text).toContain('(code 914009)');
      expect(notice.text).not.toContain('not shown');
    });

    it('points at the account history when the service holds an earlier attempt', async () => {
      // The snapshot the page acted on did not show the attempt yet.
      api.serviceBinanceDeposit.revalidateBeforeSign.mockRejectedValue({
        code: EBinanceDepositLocalErrorCode.SendAttemptUnresolved,
        message: 'not shown',
        autoToast: true,
      });
      const context = setup();
      await context.run();

      expect(context.navigationToTxConfirm).not.toHaveBeenCalled();
      expect(context.logSendResult).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'blocked',
          reason: 'send_attempt_unresolved',
        }),
      );
      expect(mockedToastError).not.toHaveBeenCalled();
      const notice = context.setNotice.mock.calls.at(-1)?.[0] as {
        type: string;
        text: string;
      };
      expect(notice.type).toBe('critical');
      expect(notice.text).toContain('account history');
      expect(notice.text).toContain('(code 914013)');
      // Not the text of an address that failed re-verification.
      expect(notice.text).not.toContain('re-verified');
      expect(notice.text).not.toContain('not shown');
      // Brings the hold, with its acknowledge button, onto the page.
      expect(context.refreshState).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirm page', () => {
    it('goes straight to the confirm page with the server address', async () => {
      const context = setup({ amountInput: '5.50' });
      await context.run();

      // The check made before the confirm page opens does not mark a signing
      // attempt: nothing can be signed yet.
      expect(api.serviceBinanceDeposit.revalidateBeforeSign.mock.calls).toEqual(
        [['local-id-0001']],
      );
      const confirmParams = context.getConfirmParams();
      const expectedToken = {
        ...usdtToken,
        accountId: ACCOUNT_ID,
        networkId: NETWORK_ID,
      };
      expect(confirmParams.transfersInfo).toEqual([
        {
          from: SENDER,
          to: DEPOSIT_ADDRESS,
          amount: '5.5',
          tokenInfo: expectedToken,
          memo: undefined,
        },
      ]);
      expect(confirmParams.transferPayload).toEqual({
        amountToSend: '5.5',
        isMaxSend: false,
        isNFT: false,
        originalRecipient: DEPOSIT_ADDRESS,
        isToContract: false,
        memo: undefined,
        tokenInfo: expectedToken,
      });
      expect(confirmParams.isInternalTransfer).toBe(true);
      expect(mockedToastError).not.toHaveBeenCalled();
    });

    it('reports a failed build as blocked, not as a confirm page failure', async () => {
      const context = setup();
      context.navigationToTxConfirm.mockImplementation(async (params) => {
        params.onFail?.(new Error('build failed'));
      });
      await context.run();
      expect(context.logSendResult).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'blocked', reason: 'build_failed' }),
      );
      expect(api.serviceBinanceDeposit.submitReport).not.toHaveBeenCalled();
    });

    it('turns an unexpected error into a fixed message', async () => {
      const secret = 'https://app.binance.com/en/connect?token=secret';
      api.serviceToken.fetchTokensDetails.mockRejectedValue(new Error(secret));
      const context = setup();
      await expect(context.run()).resolves.toBeUndefined();
      expectBlocked(context, 'preflight_error');
      expect(JSON.stringify(context.setNotice.mock.calls)).not.toContain(
        secret,
      );
      expect(JSON.stringify(context.logSendResult.mock.calls)).not.toContain(
        secret,
      );
      expect(JSON.stringify(mockedToastError.mock.calls)).not.toContain(secret);
    });
  });

  describe('onBeforeSend', () => {
    it('re-verifies the session right before signing', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      api.serviceBinanceDeposit.revalidateBeforeSign.mockClear();

      await expect(confirmParams.onBeforeSend?.()).resolves.toBeUndefined();
      // This is the check that gates the signature, so it is the one that
      // records the attempt.
      expect(api.serviceBinanceDeposit.revalidateBeforeSign.mock.calls).toEqual(
        [['local-id-0001', { markSendAttempt: true }]],
      );
    });

    it('refuses to sign a second time on the same confirm page', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      api.serviceBinanceDeposit.revalidateBeforeSign.mockClear();
      api.serviceDevSetting.getDevSetting.mockClear();

      // First confirm: the check passes and signing may start.
      await expect(confirmParams.onBeforeSend?.()).resolves.toBeUndefined();
      // The confirm page reports a failure and stays open with its button
      // enabled; a broadcast that timed out may still have gone through.
      confirmParams.onFail?.(new Error('broadcast timed out'));
      expect(context.logSendResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ result: 'fail' }),
      );
      // Said above the confirm page too, not only on the covered one.
      expect(mockedToastError).toHaveBeenCalledTimes(1);
      expect(mockedToastError).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Transfer result unknown',
          message: expect.stringContaining('account history') as string,
        }),
      );

      // Second confirm on the same page: stopped before anything is checked
      // or signed.
      await expect(confirmParams.onBeforeSend?.()).rejects.toMatchObject({
        autoToast: false,
      });
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).toHaveBeenCalledTimes(1);
      expect(api.serviceDevSetting.getDevSetting).toHaveBeenCalledTimes(1);
      expect(mockedToastError).toHaveBeenCalledTimes(2);
      expect(mockedToastError).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Transfer blocked',
          message: expect.stringContaining('account history') as string,
        }),
      );

      confirmParams.onFail?.(new Error('blocked'));
      expect(context.logSendResult).toHaveBeenLastCalledWith(
        expect.objectContaining({
          result: 'blocked',
          reason: 'repeat_sign_blocked',
        }),
      );
      expect(context.setNotice).toHaveBeenLastCalledWith({
        type: 'critical',
        text: expect.stringContaining('account history') as string,
      });

      // And it stays that way for as long as the page is open.
      await expect(confirmParams.onBeforeSend?.()).rejects.toMatchObject({
        autoToast: false,
      });
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).toHaveBeenCalledTimes(1);
      expect(api.serviceBinanceDeposit.submitReport).not.toHaveBeenCalled();
    });

    it('refuses a second signature even when no failure was reported in between', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      api.serviceBinanceDeposit.revalidateBeforeSign.mockClear();

      await expect(confirmParams.onBeforeSend?.()).resolves.toBeUndefined();
      await expect(confirmParams.onBeforeSend?.()).rejects.toMatchObject({
        autoToast: false,
      });
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).toHaveBeenCalledTimes(1);
    });

    it('allows another try after a check stopped the page before signing', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      api.serviceBinanceDeposit.revalidateBeforeSign.mockClear();
      const failure = {
        code: EBinanceDepositLocalErrorCode.RequestFailed,
        autoToast: true,
      };
      api.serviceBinanceDeposit.revalidateBeforeSign.mockRejectedValueOnce(
        failure,
      );

      // Nothing was signed: the check itself failed.
      await expect(confirmParams.onBeforeSend?.()).rejects.toBe(failure);
      confirmParams.onFail?.(new Error('blocked'));
      expect(context.logSendResult).toHaveBeenLastCalledWith(
        expect.objectContaining({
          result: 'blocked',
          reason: 'before_send_check',
        }),
      );

      await expect(confirmParams.onBeforeSend?.()).resolves.toBeUndefined();
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).toHaveBeenCalledTimes(2);
    });

    it('does not carry the refusal over to a confirm page opened later', async () => {
      const first = setup();
      await first.run();
      await expect(
        first.getConfirmParams().onBeforeSend?.(),
      ).resolves.toBeUndefined();

      const second = setup();
      await second.run();
      await expect(
        second.getConfirmParams().onBeforeSend?.(),
      ).resolves.toBeUndefined();
    });

    it('does not call a failure before signing a transfer of unknown result', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();

      // onBeforeSend never passed, so nothing can have been broadcast and
      // the confirm page's own error toast is all there is.
      confirmParams.onFail?.(new Error('fee estimation failed'));
      expect(context.logSendResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ result: 'fail' }),
      );
      expect(mockedToastError).not.toHaveBeenCalled();
    });

    it('rejects with the background error when re-verification fails', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      const failure = {
        code: EBinanceDepositLocalErrorCode.RevalidateFailed,
        autoToast: true,
      };
      api.serviceBinanceDeposit.revalidateBeforeSign.mockRejectedValue(failure);

      await expect(confirmParams.onBeforeSend?.()).rejects.toBe(failure);

      // The confirm page reports the rejection through onFail.
      confirmParams.onFail?.(new Error('blocked'));
      expect(context.logSendResult).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'blocked',
          reason: 'before_send_check',
        }),
      );
    });

    it('stops before signing when the service holds an earlier attempt', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      api.serviceBinanceDeposit.revalidateBeforeSign.mockClear();
      // Another confirm page of the same session marked its attempt first.
      const refusal = {
        code: EBinanceDepositLocalErrorCode.SendAttemptUnresolved,
        autoToast: true,
      };
      api.serviceBinanceDeposit.revalidateBeforeSign.mockRejectedValue(refusal);

      await expect(confirmParams.onBeforeSend?.()).rejects.toBe(refusal);
      expect(api.serviceBinanceDeposit.revalidateBeforeSign.mock.calls).toEqual(
        [['local-id-0001', { markSendAttempt: true }]],
      );

      confirmParams.onFail?.(new Error('blocked'));
      expect(context.logSendResult).toHaveBeenLastCalledWith(
        expect.objectContaining({
          result: 'blocked',
          reason: 'send_attempt_unresolved',
        }),
      );
      const notice = context.setNotice.mock.calls.at(-1)?.[0] as {
        type: string;
        text: string;
      };
      expect(notice.type).toBe('critical');
      expect(notice.text).toContain('account history');
      expect(notice.text).not.toContain('re-verified');
      expect(context.refreshState).toHaveBeenCalled();
      expect(api.serviceBinanceDeposit.submitReport).not.toHaveBeenCalled();

      // Nothing was signed on this page, and every further confirm asks the
      // service again, which keeps refusing.
      await expect(confirmParams.onBeforeSend?.()).rejects.toBe(refusal);
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).toHaveBeenCalledTimes(2);
    });

    it('rejects without re-verifying when the sign-only switch was turned on', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      api.serviceBinanceDeposit.revalidateBeforeSign.mockClear();
      api.serviceDevSetting.getDevSetting.mockResolvedValue({
        enabled: true,
        settings: { alwaysSignOnlySendTx: true },
      });

      await expect(confirmParams.onBeforeSend?.()).rejects.toMatchObject({
        autoToast: false,
      });
      expect(
        api.serviceBinanceDeposit.revalidateBeforeSign,
      ).not.toHaveBeenCalled();
      expect(mockedToastError).toHaveBeenCalledTimes(1);
    });

    it('rejects when the switch cannot be read', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      api.serviceDevSetting.getDevSetting.mockRejectedValue(
        new Error('bridge'),
      );
      await expect(confirmParams.onBeforeSend?.()).rejects.toBeDefined();
    });
  });

  describe('onSuccess', () => {
    it('reports the broadcast transaction id and its owner', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();

      confirmParams.onSuccess?.(buildSuccessData());
      await flushPromises();

      expect(context.onSent).toHaveBeenCalledWith('local-id-0001');
      expect(api.serviceBinanceDeposit.submitReport).toHaveBeenCalledWith({
        localId: 'local-id-0001',
        txHash: TX_HASH,
        senderAddress: SENDER,
      });
      expect(context.logSendResult).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'success',
          txHashPrefix: `${TX_HASH.slice(0, 10)}…`,
        }),
      );
      expect(context.setNotice).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'success' }),
      );
      expect(context.refreshState).toHaveBeenCalled();
    });

    it('adds the 0x prefix an EVM report needs', async () => {
      const context = setup();
      await context.run();
      context
        .getConfirmParams()
        .onSuccess?.(buildSuccessData({ txid: 'ab'.repeat(32) }));
      await flushPromises();
      expect(api.serviceBinanceDeposit.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({ txHash: TX_HASH }),
      );
    });

    it('falls back to the session sender when the owner is missing', async () => {
      const context = setup();
      await context.run();
      context
        .getConfirmParams()
        .onSuccess?.(buildSuccessData({ owner: undefined }));
      await flushPromises();
      expect(api.serviceBinanceDeposit.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({ senderAddress: SENDER }),
      );
    });

    it('shows a pending report as pending', async () => {
      api.serviceBinanceDeposit.submitReport.mockResolvedValue(
        buildSession({
          report: {
            txHash: TX_HASH,
            senderAddress: SENDER,
            status: 'PENDING',
            attempts: 1,
            updatedAt: 2,
          },
        }),
      );
      const context = setup();
      await context.run();
      context.getConfirmParams().onSuccess?.(buildSuccessData());
      await flushPromises();
      expect(context.setNotice).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'warning' }),
      );
    });

    it('does not report without a transaction id', async () => {
      const context = setup();
      await context.run();
      context.getConfirmParams().onSuccess?.(buildSuccessData({ txid: '' }));
      await flushPromises();
      expect(api.serviceBinanceDeposit.submitReport).not.toHaveBeenCalled();
      expect(context.onSent).toHaveBeenCalledWith('local-id-0001');
    });

    it('does not report when the sign-only switch is on at that moment', async () => {
      const context = setup({ isSignOnlyEnabledNow: () => true });
      await context.run();
      context.getConfirmParams().onSuccess?.(buildSuccessData());
      await flushPromises();
      expect(api.serviceBinanceDeposit.submitReport).not.toHaveBeenCalled();
      expect(context.onSent).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty list', []],
      ['a malformed entry', [{}]],
      ['undefined', undefined],
    ])('never throws for %s', async (_name, txs) => {
      const context = setup();
      await context.run();
      const { onSuccess } = context.getConfirmParams();
      expect(() =>
        onSuccess?.(txs as unknown as ISendTxOnSuccessData[]),
      ).not.toThrow();
      await flushPromises();
      expect(api.serviceBinanceDeposit.submitReport).not.toHaveBeenCalled();
    });

    it('never throws when the report call rejects or throws', async () => {
      const context = setup();
      await context.run();
      const { onSuccess } = context.getConfirmParams();

      api.serviceBinanceDeposit.submitReport.mockRejectedValue(
        new Error('bridge'),
      );
      expect(() => onSuccess?.(buildSuccessData())).not.toThrow();
      await flushPromises();
      expect(context.setNotice).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'warning' }),
      );

      api.serviceBinanceDeposit.submitReport.mockImplementation(() => {
        throw new OneKeyLocalError('sync');
      });
      expect(() => onSuccess?.(buildSuccessData())).not.toThrow();
    });
  });

  describe('onFail / onCancel', () => {
    it('only change the notice and never report', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();

      expect(() => confirmParams.onFail?.(new Error('x'))).not.toThrow();
      expect(context.logSendResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ result: 'fail' }),
      );
      expect(context.setNotice).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'warning' }),
      );
      const noticeCalls = context.setNotice.mock.calls.length;

      // Closing the page after a failure keeps the failure notice.
      expect(() => confirmParams.onCancel?.()).not.toThrow();
      expect(context.setNotice).toHaveBeenCalledTimes(noticeCalls);
      expect(api.serviceBinanceDeposit.submitReport).not.toHaveBeenCalled();
      expect(context.onSent).not.toHaveBeenCalled();
    });

    it('logs a plain cancel', async () => {
      const context = setup();
      await context.run();
      context.getConfirmParams().onCancel?.();
      expect(context.logSendResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ result: 'cancel' }),
      );
      expect(context.onSent).not.toHaveBeenCalled();
    });

    it('still reports a success that follows an earlier failure', async () => {
      const context = setup();
      await context.run();
      const confirmParams = context.getConfirmParams();
      confirmParams.onFail?.(new Error('first attempt'));
      confirmParams.onSuccess?.(buildSuccessData());
      await flushPromises();
      expect(api.serviceBinanceDeposit.submitReport).toHaveBeenCalledTimes(1);

      // A late failure or cancel does not overwrite the success.
      const noticeCalls = context.setNotice.mock.calls.length;
      confirmParams.onFail?.(new Error('late'));
      confirmParams.onCancel?.();
      expect(context.setNotice).toHaveBeenCalledTimes(noticeCalls);
    });
  });

  it('never passes an error message to the log', async () => {
    const context = setup();
    await context.run();
    const confirmParams = context.getConfirmParams();
    confirmParams.onFail?.(new Error('sensitive failure text'));
    expect(JSON.stringify(context.logSendResult.mock.calls)).not.toContain(
      'sensitive failure text',
    );
    expect(JSON.stringify(context.setNotice.mock.calls)).not.toContain(
      'sensitive failure text',
    );
  });
});
