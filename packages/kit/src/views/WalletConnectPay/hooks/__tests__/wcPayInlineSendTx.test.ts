import BigNumber from 'bignumber.js';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PasswordPromptDialogCancel } from '@onekeyhq/shared/src/errors/errors/appErrors';
import type {
  IWcPayOption,
  IWcPayPreBroadcastRecord,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { wcPayInlineSendTx } from '../wcPayInlineSendTx';
import {
  EWcPayInlineFailureKind,
  WcPayUserCancelledError,
  isWcPayInlinePostSignError,
} from '../wcPayInlineUtils';

// Every background method the pipeline touches must exist here: a missing one
// throws a TypeError inside a stage's try/catch and would be silently
// reclassified as that stage's failure, hiding the behavior under test.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      checkIsWalletNotBackedUp: jest.fn(),
      getAccountAddressForApi: jest.fn(),
    },
    serviceGas: {
      buildEstimateFeeParams: jest.fn(),
      estimateFee: jest.fn(),
    },
    serviceToken: {
      getNativeTokenAddress: jest.fn(),
      fetchTokensDetails: jest.fn(),
    },
    serviceSend: {
      getNextNonce: jest.fn(),
      updateUnSignedTxBeforeSending: jest.fn(),
      precheckUnsignedTxs: jest.fn(),
      signAndSendTransaction: jest.fn(),
      buildDecodedTx: jest.fn(),
    },
    serviceSignatureConfirm: {
      preActionsBeforeSending: jest.fn(),
    },
    serviceTransaction: {
      verifyTransaction: jest.fn(),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: jest.fn(),
    },
    serviceSignature: {
      addItemFromSendProcess: jest.fn(),
    },
  },
}));

// The mocked proxy re-typed as plain jest.Mock properties. Reading the real
// service types here would treat each entry as an unbound method, and the
// mock-configuring calls below would have no `mockResolvedValue` to reach for.
type IMockedService = Record<string, jest.Mock>;

const api = backgroundApiProxy as unknown as {
  serviceAccount: IMockedService;
  serviceGas: IMockedService;
  serviceToken: IMockedService;
  serviceSend: IMockedService;
  serviceSignatureConfirm: IMockedService;
  serviceTransaction: IMockedService;
  serviceHistory: IMockedService;
  serviceSignature: IMockedService;
};

const SENDER = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x2222222222222222222222222222222222222222';
const RECIPIENT = '0x3333333333333333333333333333333333333333';
const NETWORK_ID = 'evm--8453';
const ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
const NONCE = 7;
const TXID = '0xdeadbeef';

// 21000 gas * 1 Gwei
const FEE_WEI = 21_000_000_000_000;
const ONE_ETH_WEI = '1000000000000000000';

// transfer(RECIPIENT, 1_000_000)
const TRANSFER_DATA = `0xa9059cbb${RECIPIENT.slice(2).padStart(64, '0')}${(1_000_000)
  .toString(16)
  .padStart(64, '0')}`;

// approve(PERMIT2, 1_000_000) — the Permit2 approve leg's calldata
const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const APPROVE_DATA = `0x095ea7b3${PERMIT2_ADDRESS.slice(2).padStart(
  64,
  '0',
)}${(1_000_000).toString(16).padStart(64, '0')}`;

const option: IWcPayOption = {
  id: 'opt-1',
  account: `eip155:8453:${SENDER}`,
  amount: {
    unit: 'usdc',
    value: '1000000',
    display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
  },
  etaS: 10,
  actions: [],
};

// same order, paid natively: 1 ETH with empty calldata
const nativeOption: IWcPayOption = {
  ...option,
  amount: {
    unit: 'eth',
    value: ONE_ETH_WEI,
    display: { assetSymbol: 'ETH', assetName: 'Ethereum', decimals: 18 },
  },
};

const sourceInfo: IDappSourceInfo = {
  id: '',
  origin: 'https://pay.walletconnect.com',
  hostname: 'pay.walletconnect.com',
  scope: 'ethereum',
  data: { method: 'eth_sendTransaction', params: [] },
  isWalletConnectRequest: false,
};

const preBroadcastRecord: IWcPayPreBroadcastRecord = {
  paymentId: 'pay_1',
  optionId: 'opt-1',
  accountKey: ACCOUNT_ID,
  action: {
    walletRpc: {
      chainId: 'eip155:8453',
      method: 'eth_sendTransaction',
      params: '[]',
    },
  },
  index: 0,
};

const baseEncodedTx: IEncodedTxEvm = {
  from: SENDER,
  to: TOKEN,
  value: '0x0',
  data: TRANSFER_DATA,
};

const nativeEncodedTx: IEncodedTxEvm = {
  from: SENDER,
  to: RECIPIENT,
  value: '0xde0b6b3a7640000', // 1e18
  data: '0x',
};

function buildUnsignedTx(): IUnsignedTxPro {
  return { encodedTx: { ...baseEncodedTx }, nonce: NONCE };
}

// What updateUnSignedTxBeforeSending really hands back: by this point the vault
// has written the hex chainId, the nonce and the fee fields into encodedTx.
function buildUpdatedUnsignedTx(
  overrides: Partial<IEncodedTxEvm> = {},
  encodedTxBase: IEncodedTxEvm = baseEncodedTx,
): IUnsignedTxPro {
  return {
    encodedTx: {
      ...encodedTxBase,
      chainId: '0x2105',
      nonce: NONCE,
      gas: '0x5208',
      gasLimit: '0x5208',
      gasPrice: '0x3b9aca00',
      ...overrides,
    },
    nonce: NONCE,
  };
}

function buildTokenDetail({
  address,
  symbol,
  decimals,
  balance,
  isNative,
}: {
  address: string;
  symbol: string;
  decimals: number;
  balance: string;
  isNative: boolean;
}) {
  return {
    info: { address, symbol, decimals, isNative, name: symbol },
    balance,
    balanceParsed: '0',
    fiatValue: '0',
    price: 1,
  };
}

function mockBalances({
  tokenBalance = '5000000',
  nativeBalance = ONE_ETH_WEI,
  emptyResponse = false,
}: {
  tokenBalance?: string;
  nativeBalance?: string;
  emptyResponse?: boolean;
} = {}) {
  api.serviceToken.fetchTokensDetails.mockImplementation(
    async ({ contractList }: { contractList: string[] }) => {
      if (emptyResponse) {
        return [];
      }
      return contractList[0] === TOKEN
        ? [
            buildTokenDetail({
              address: TOKEN,
              symbol: 'USDC',
              decimals: 6,
              balance: tokenBalance,
              isNative: false,
            }),
          ]
        : [
            buildTokenDetail({
              address: '',
              symbol: 'ETH',
              decimals: 18,
              balance: nativeBalance,
              isNative: true,
            }),
          ];
    },
  );
}

function callInlineSend(
  params: {
    expiryMs?: number;
    networkId?: string;
    option?: IWcPayOption;
    unsignedTx?: IUnsignedTxPro;
    wcPayPreBroadcastRecord?: IWcPayPreBroadcastRecord;
    onPhase?: (phase: string) => void;
    intent?: 'transfer' | 'approve';
  } = {},
) {
  const {
    networkId,
    option: optionOverride,
    unsignedTx,
    intent,
    ...rest
  } = params;
  return wcPayInlineSendTx({
    networkId: networkId ?? NETWORK_ID,
    accountId: ACCOUNT_ID,
    unsignedTx: unsignedTx ?? buildUnsignedTx(),
    option: optionOverride ?? option,
    sourceInfo,
    intent: intent ?? 'transfer',
    ...rest,
  });
}

// The hard aborts all throw the same user-facing copy, so the assertion that
// tells them apart is the diagnostic each one logs before throwing. Tests
// check both: a guard firing for the wrong reason still fails.
const GENERIC_ABORT_MESSAGE = 'This payment cannot be completed right now';
let consoleErrorSpy: jest.SpyInstance;
const loggedDiagnostics = () =>
  consoleErrorSpy.mock.calls
    .map((args: unknown[]) => args.map((arg) => String(arg)).join(' '))
    .join('\n');

beforeEach(() => {
  jest.clearAllMocks();

  api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(false);
  api.serviceAccount.getAccountAddressForApi.mockResolvedValue(SENDER);

  api.serviceGas.buildEstimateFeeParams.mockResolvedValue({
    encodedTx: baseEncodedTx,
    estimateFeeParams: undefined,
  });
  // 21000 gasLimit * 1 Gwei = 0.000021 ETH. Index 1 is the preset the pipeline
  // picks; index 0 is only the low fallback.
  api.serviceGas.estimateFee.mockResolvedValue({
    common: {
      feeDecimals: 9,
      feeSymbol: 'Gwei',
      nativeDecimals: 18,
      nativeSymbol: 'ETH',
      nativeTokenPrice: 2000,
    },
    gas: [
      { gasPrice: '1', gasLimit: '21000' },
      { gasPrice: '1', gasLimit: '21000' },
    ],
    gasEIP1559: undefined,
  });

  api.serviceToken.getNativeTokenAddress.mockResolvedValue('');
  mockBalances();

  api.serviceSend.getNextNonce.mockResolvedValue(NONCE);
  api.serviceSend.updateUnSignedTxBeforeSending.mockResolvedValue([
    buildUpdatedUnsignedTx(),
  ]);
  api.serviceSend.precheckUnsignedTxs.mockResolvedValue(undefined);
  api.serviceSend.signAndSendTransaction.mockResolvedValue({
    txid: TXID,
    rawTx: '0xraw',
  });
  api.serviceSend.buildDecodedTx.mockResolvedValue({ txid: TXID });
  api.serviceSignatureConfirm.preActionsBeforeSending.mockResolvedValue({});
  api.serviceTransaction.verifyTransaction.mockResolvedValue({});
  api.serviceHistory.saveSendConfirmHistoryTxs.mockResolvedValue(undefined);
  api.serviceSignature.addItemFromSendProcess.mockResolvedValue(undefined);

  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('wcPayInlineSendTx', () => {
  // The check shows the backup dialog itself, and the confirm page is a dead
  // end for this state (it re-shows the dialog and its submit returns without
  // sending), so this must never be a fallback.
  it('ends the payment inline when the wallet is not backed up', async () => {
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(true);

    const result = await callInlineSend({});

    expect(result.status).toBe('inlineError');
    expect(
      result.status === 'inlineError' ? result.failure.kind : undefined,
    ).toBe(EWcPayInlineFailureKind.WalletNotBackedUp);
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('resolves with the txid on the happy path', async () => {
    const phases: string[] = [];
    const result = await callInlineSend({
      onPhase: (phase) => phases.push(phase),
    });

    expect(result).toEqual({ status: 'ok', txid: TXID });
    expect(phases).toEqual(['estimating', 'checking', 'signing', 'recording']);
    expect(api.serviceSend.signAndSendTransaction).toHaveBeenCalledTimes(1);
  });

  it('sends a plain native transfer, reading only the native balance', async () => {
    api.serviceSend.updateUnSignedTxBeforeSending.mockResolvedValue([
      buildUpdatedUnsignedTx({}, nativeEncodedTx),
    ]);
    // enough for the 1 ETH transfer plus the fee
    mockBalances({
      nativeBalance: new BigNumber(ONE_ETH_WEI).plus(FEE_WEI).toFixed(),
    });

    const result = await callInlineSend({
      option: nativeOption,
      unsignedTx: { encodedTx: { ...nativeEncodedTx }, nonce: NONCE },
    });

    expect(result).toEqual({ status: 'ok', txid: TXID });
    // empty calldata means no token contract to look up
    expect(api.serviceToken.fetchTokensDetails).toHaveBeenCalledTimes(1);
  });

  it('derives the nonce when the unsigned tx has none, and validates against it', async () => {
    const derivedNonce = 42;
    api.serviceSend.getNextNonce.mockResolvedValue(derivedNonce);
    api.serviceSend.updateUnSignedTxBeforeSending.mockResolvedValue([
      buildUpdatedUnsignedTx({ nonce: derivedNonce }),
    ]);

    const result = await callInlineSend({
      unsignedTx: { encodedTx: { ...baseEncodedTx } },
    });

    expect(api.serviceSend.getNextNonce).toHaveBeenCalledTimes(1);
    expect(api.serviceSend.updateUnSignedTxBeforeSending).toHaveBeenCalledWith(
      expect.objectContaining({ nonceInfo: { nonce: derivedNonce } }),
    );
    // resolving ok proves the recheck ran with expectedNonce = derivedNonce:
    // the tx carries 42, and NONCE (7) would have been a mismatch
    expect(result).toEqual({ status: 'ok', txid: TXID });
  });

  it('passes the send parameters the WC Pay boundaries depend on', async () => {
    const expiryMs = Date.now() + 60_000;

    await callInlineSend({
      expiryMs,
      wcPayPreBroadcastRecord: preBroadcastRecord,
    });

    expect(api.serviceSend.signAndSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        signOnly: false,
        broadcastDeadline: expiryMs,
        wcPayPreBroadcastRecord: preBroadcastRecord,
      }),
    );
    expect(api.serviceSignature.addItemFromSendProcess).toHaveBeenCalledWith(
      expect.anything(),
      sourceInfo,
    );
  });

  it('returns an inline feeEstimateFailed error when estimation rejects', async () => {
    api.serviceGas.estimateFee.mockRejectedValue(new Error('rpc down'));

    const result = await callInlineSend();

    expect(result.status).toBe('inlineError');
    if (result.status !== 'ok') {
      expect(result.failure.kind).toBe(
        EWcPayInlineFailureKind.FeeEstimateFailed,
      );
    }
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('returns an inline insufficientBalance error when the token balance is short', async () => {
    mockBalances({ tokenBalance: '10' });

    const result = await callInlineSend();

    expect(result.status).toBe('inlineError');
    if (result.status !== 'ok') {
      expect(result.failure.kind).toBe(
        EWcPayInlineFailureKind.InsufficientBalance,
      );
      expect(result.failure.message).toContain('USDC');
    }
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('falls back rather than claiming insufficient funds when balances are unreadable', async () => {
    mockBalances({ emptyResponse: true });

    const result = await callInlineSend();

    expect(result.status).toBe('fallback');
    if (result.status !== 'ok') {
      expect(result.failure.kind).toBe(EWcPayInlineFailureKind.PreSignBlocked);
      expect(result.failure.kind).not.toBe(
        EWcPayInlineFailureKind.InsufficientBalance,
      );
    }
  });

  it('falls back when the precheck rejects', async () => {
    api.serviceSend.precheckUnsignedTxs.mockRejectedValue(
      new Error('precheck blocked'),
    );

    const result = await callInlineSend();

    expect(result.status).toBe('fallback');
    if (result.status !== 'ok') {
      expect(result.failure.kind).toBe(EWcPayInlineFailureKind.PreSignBlocked);
    }
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('falls back when the user declines the fee-overflow confirmation', async () => {
    api.serviceTransaction.verifyTransaction.mockRejectedValue(
      new Error('Network fee is too high'),
    );

    const result = await callInlineSend();

    expect(result.status).toBe('fallback');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('throws once the payment deadline has passed, before signing', async () => {
    await expect(
      callInlineSend({ expiryMs: Date.now() - 1000 }),
    ).rejects.toThrow('This payment has expired');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('throws when the signing account does not match the order account', async () => {
    api.serviceAccount.getAccountAddressForApi.mockResolvedValue(RECIPIENT);

    await expect(callInlineSend()).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(loggedDiagnostics()).toContain('account mismatch');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('throws when the order account carries an empty address segment', async () => {
    await expect(
      callInlineSend({ option: { ...option, account: 'eip155:8453:' } }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(loggedDiagnostics()).toContain('account mismatch');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('throws when the send network is not the network the order names', async () => {
    await expect(callInlineSend({ networkId: 'evm--1' })).rejects.toThrow(
      GENERIC_ABORT_MESSAGE,
    );
    expect(loggedDiagnostics()).toContain('network mismatch');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('throws without signing when the final tx no longer matches the order', async () => {
    // the vault handed back a tx that now also moves native value
    api.serviceSend.updateUnSignedTxBeforeSending.mockResolvedValue([
      buildUpdatedUnsignedTx({ value: '0x1' }),
    ]);

    await expect(callInlineSend()).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(loggedDiagnostics()).toContain('changed after validation');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('throws without signing when the final nonce is not the one the pipeline decided', async () => {
    api.serviceSend.updateUnSignedTxBeforeSending.mockResolvedValue([
      buildUpdatedUnsignedTx({ nonce: NONCE + 1 }),
    ]);

    await expect(callInlineSend()).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    // the reason still reaches the log, so this stays distinguishable from
    // the other post-mutation rejections
    expect(loggedDiagnostics()).toContain('nonce mismatch');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('propagates a send failure instead of converting it to a fallback', async () => {
    api.serviceSend.signAndSendTransaction.mockRejectedValue(
      new Error('broadcast rejected'),
    );

    await expect(callInlineSend()).rejects.toThrow('broadcast rejected');
  });

  it('keeps a password-prompt cancel inside the send call a plain user cancel', async () => {
    // the password / hardware prompt pops inside signAndSendTransaction,
    // before anything is signed — a cancel there must not be tagged
    // post-sign, or the flow would lock behind a spurious SendFailed banner
    api.serviceSend.signAndSendTransaction.mockRejectedValue(
      new PasswordPromptDialogCancel(),
    );

    const error = await callInlineSend().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WcPayUserCancelledError);
    expect(isWcPayInlinePostSignError(error)).toBe(false);
  });

  it('tags post-sign throws and leaves pre-sign throws untagged', async () => {
    api.serviceSend.signAndSendTransaction.mockRejectedValue(
      new Error('broadcast rejected'),
    );
    const postSignError = await callInlineSend().catch(
      (error: unknown) => error,
    );
    expect(isWcPayInlinePostSignError(postSignError)).toBe(true);

    const preSignError = await callInlineSend({
      expiryMs: Date.now() - 1000,
    }).catch((error: unknown) => error);
    expect(isWcPayInlinePostSignError(preSignError)).toBe(false);
  });

  it('tags a missing txid as post-sign: the transfer may already be on chain', async () => {
    api.serviceSend.signAndSendTransaction.mockResolvedValue({
      rawTx: '0xraw',
    });

    const error = await callInlineSend().catch((e: unknown) => e);

    expect((error as Error).message).toContain('Missing transaction id');
    expect(isWcPayInlinePostSignError(error)).toBe(true);
  });

  it('keeps the txid when the post-broadcast bookkeeping fails', async () => {
    api.serviceHistory.saveSendConfirmHistoryTxs.mockRejectedValue(
      new Error('history write failed'),
    );
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await callInlineSend();

    expect(result).toEqual({ status: 'ok', txid: TXID });
    // the signature record runs first, so a failing history save cannot drop it
    expect(api.serviceSignature.addItemFromSendProcess).toHaveBeenCalledTimes(
      1,
    );
    consoleError.mockRestore();
  });
});

describe('wcPayInlineSendTx — plan intent vs final kind', () => {
  const approveUnsignedTx = (): IUnsignedTxPro => ({
    encodedTx: { from: SENDER, to: TOKEN, value: '0x0', data: APPROVE_DATA },
    nonce: NONCE,
  });

  it('broadcasts an approve-shaped tx under the approve intent', async () => {
    api.serviceSend.updateUnSignedTxBeforeSending.mockResolvedValue([
      buildUpdatedUnsignedTx({ data: APPROVE_DATA }),
    ]);

    await expect(
      callInlineSend({ unsignedTx: approveUnsignedTx(), intent: 'approve' }),
    ).resolves.toEqual({ status: 'ok', txid: TXID });
  });

  it('throws without signing when a transfer intent resolves to approve calldata', async () => {
    api.serviceSend.updateUnSignedTxBeforeSending.mockResolvedValue([
      buildUpdatedUnsignedTx({ data: APPROVE_DATA }),
    ]);

    await expect(
      callInlineSend({ unsignedTx: approveUnsignedTx(), intent: 'transfer' }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(loggedDiagnostics()).toContain('kind changed after validation');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('throws without signing when an approve intent resolves to transfer calldata', async () => {
    await expect(callInlineSend({ intent: 'approve' })).rejects.toThrow(
      GENERIC_ABORT_MESSAGE,
    );
    expect(loggedDiagnostics()).toContain('kind changed after validation');
    expect(api.serviceSend.signAndSendTransaction).not.toHaveBeenCalled();
  });
});
