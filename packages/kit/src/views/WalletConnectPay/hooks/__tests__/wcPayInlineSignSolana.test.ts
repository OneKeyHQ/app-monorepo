import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PasswordPromptDialogCancel } from '@onekeyhq/shared/src/errors/errors/appErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { wcPayInlineSignSolanaTx } from '../wcPayInlineSignSolana';
import { WcPayUserCancelledError } from '../wcPayInlineUtils';

// yarn jest packages/kit/src/views/WalletConnectPay/hooks/__tests__/wcPayInlineSignSolana.test.ts

// Every background method the pipeline touches must exist here: a missing one
// would throw a TypeError that a caller could mistake for a real signing
// failure, hiding the behavior under test.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      checkIsWalletNotBackedUp: jest.fn(),
      getAccountAddressForApi: jest.fn(),
    },
    serviceSend: {
      signTransaction: jest.fn(),
      buildDecodedTx: jest.fn(),
    },
    serviceSignature: {
      addItemFromSendProcess: jest.fn(),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: jest.fn(),
    },
    serviceWalletConnectPay: {
      isSolanaMessageUnchanged: jest.fn(),
    },
  },
}));

// The mocked proxy re-typed as plain jest.Mock properties. Reading the real
// service types here would treat each entry as an unbound method, and the
// mock-configuring calls below would have no `mockResolvedValue` to reach for.
type IMockedService = Record<string, jest.Mock>;

const api = backgroundApiProxy as unknown as {
  serviceAccount: IMockedService;
  serviceSend: IMockedService;
  serviceSignature: IMockedService;
  serviceHistory: IMockedService;
  serviceWalletConnectPay: IMockedService;
};

const NETWORK_ID = 'sol--101';
const ACCOUNT_ID = "hd-1--m/44'/501'/0'/0'";
// Mixed case on purpose: base58 is case-SENSITIVE, so a lowercased copy of
// this address must read as a different account, not the same one.
const PAYER = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
const OTHER_PAYER = '7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2';
const CHAIN_REFERENCE = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const TX_BASE64 = 'dW5zaWduZWQ=';
const SIGNED_RAW_TX = 'c2lnbmVk';
const GENERIC_ABORT_MESSAGE = 'This payment cannot be completed right now';
const MISMATCH_MESSAGE =
  'Signed transaction does not match the payment request';

const unsignedTx = { encodedTx: 'unsigned-bs58' } as IUnsignedTxPro;
const signedTx = { txid: 'txid-1', rawTx: SIGNED_RAW_TX };
const decodedTx = { txid: 'txid-1' };

const sourceInfo: IDappSourceInfo = {
  id: '',
  origin: 'https://pay.walletconnect.com',
  hostname: 'pay.walletconnect.com',
  scope: 'solana',
  data: { method: 'solana_signTransaction', params: [] },
  isWalletConnectRequest: false,
};

function buildOption(account: string): IWcPayOption {
  return {
    id: 'opt-1',
    account,
    amount: {
      unit: 'usdc',
      value: '1500',
      display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
    },
    etaS: 10,
    actions: [],
  };
}

const throwIfCancelled = jest.fn();
const onPhase = jest.fn();

const baseParams = {
  networkId: NETWORK_ID,
  accountId: ACCOUNT_ID,
  accountAddress: PAYER,
  option: buildOption(`solana:${CHAIN_REFERENCE}:${PAYER}`),
  unsignedTx,
  txBase64: TX_BASE64,
  sourceInfo,
  throwIfCancelled,
  onPhase,
};

let consoleErrorSpy: jest.SpyInstance;

describe('wcPayInlineSignSolanaTx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Failures below are expected to be reported, not silently swallowed;
    // spying lets a test assert that while keeping the runner quiet.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(false);
    api.serviceAccount.getAccountAddressForApi.mockResolvedValue(PAYER);
    api.serviceSend.signTransaction.mockResolvedValue(signedTx);
    api.serviceSend.buildDecodedTx.mockResolvedValue(decodedTx);
    api.serviceSignature.addItemFromSendProcess.mockResolvedValue(undefined);
    api.serviceWalletConnectPay.isSolanaMessageUnchanged.mockResolvedValue(
      true,
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // Parity target is the confirm page's sign-only path
  // (ServiceSend.batchSignAndSendTransaction with signOnly): sign, record the
  // signature, and save NO local history.
  it('signs without fee info and records the signature, never local history', async () => {
    const result = await wcPayInlineSignSolanaTx(baseParams);

    expect(result).toEqual({ status: 'ok', rawTx: SIGNED_RAW_TX });
    // Exact arguments, not objectContaining: a stray `feeInfo` here would let
    // the sol vault rewrite the message the order was proven against.
    expect(api.serviceSend.signTransaction).toHaveBeenCalledWith({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      unsignedTx,
      signOnly: true,
    });
    expect(api.serviceSignature.addItemFromSendProcess).toHaveBeenCalledWith(
      { signedTx, decodedTx },
      sourceInfo,
    );
    expect(api.serviceHistory.saveSendConfirmHistoryTxs).not.toHaveBeenCalled();
  });

  it('proves the signed blob still carries the checked message', async () => {
    await wcPayInlineSignSolanaTx(baseParams);

    expect(
      api.serviceWalletConnectPay.isSolanaMessageUnchanged,
    ).toHaveBeenCalledWith({
      unsignedBase64: TX_BASE64,
      signedBase64: SIGNED_RAW_TX,
    });
  });

  it('aborts when the wallet is not backed up (the check shows its own dialog)', async () => {
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(true);

    await expect(wcPayInlineSignSolanaTx(baseParams)).resolves.toEqual({
      status: 'abort',
    });
    expect(api.serviceSend.signTransaction).not.toHaveBeenCalled();
    expect(onPhase).not.toHaveBeenCalled();
  });

  // The guard binds the order to the KEY behind accountId, so the address it
  // trusts is the one derived from that key — never a caller-supplied one.
  it('refuses to sign when the order names an account other than the signing key', async () => {
    await expect(
      wcPayInlineSignSolanaTx({
        ...baseParams,
        option: buildOption(`solana:${CHAIN_REFERENCE}:${OTHER_PAYER}`),
      }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(api.serviceSend.signTransaction).not.toHaveBeenCalled();
    // the user-facing copy is generic, so the diagnostic is what tells this
    // guard apart from the other hard aborts
    expect(
      consoleErrorSpy.mock.calls
        .map((args: unknown[]) => args.map((arg) => String(arg)).join(' '))
        .join('\n'),
    ).toContain('wcPay inline account mismatch');
  });

  it('refuses to sign when the payload address is not the signing key', async () => {
    await expect(
      wcPayInlineSignSolanaTx({
        ...baseParams,
        accountAddress: OTHER_PAYER,
      }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(api.serviceSend.signTransaction).not.toHaveBeenCalled();
  });

  // Base58 encodes case as data: 'a' and 'A' are different bytes, so two
  // addresses differing only in case are two different accounts.
  it('treats a differently-cased base58 address as a different account', async () => {
    await expect(
      wcPayInlineSignSolanaTx({
        ...baseParams,
        option: buildOption(`solana:${CHAIN_REFERENCE}:${PAYER.toLowerCase()}`),
      }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(api.serviceSend.signTransaction).not.toHaveBeenCalled();
  });

  it('falls back when the signing account cannot be resolved', async () => {
    api.serviceAccount.getAccountAddressForApi.mockRejectedValueOnce(
      new Error('no account'),
    );

    await expect(wcPayInlineSignSolanaTx(baseParams)).resolves.toEqual({
      status: 'fallback',
      reason: 'no account',
    });
    expect(api.serviceSend.signTransaction).not.toHaveBeenCalled();
  });

  // The backup check raises a dialog as a side effect, so an already-cancelled
  // flow must be stopped before it, not after.
  it('stops on entry without running the backup check', async () => {
    const cancelled = new WcPayUserCancelledError('x');
    throwIfCancelled.mockImplementationOnce(() => {
      throw cancelled;
    });

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toBe(cancelled);
    expect(api.serviceAccount.checkIsWalletNotBackedUp).not.toHaveBeenCalled();
    expect(api.serviceSend.signTransaction).not.toHaveBeenCalled();
  });

  it('propagates a cancellation raised at the last pre-sign gate', async () => {
    const cancelled = new WcPayUserCancelledError('x');
    throwIfCancelled
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw cancelled;
      });

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toBe(cancelled);
    expect(api.serviceAccount.checkIsWalletNotBackedUp).toHaveBeenCalled();
    expect(api.serviceSend.signTransaction).not.toHaveBeenCalled();
  });

  it('checks for cancellation on entry and again before announcing the phase', async () => {
    await wcPayInlineSignSolanaTx(baseParams);

    expect(throwIfCancelled).toHaveBeenCalledTimes(2);
    const [entryCall, preSignCall] = throwIfCancelled.mock.invocationCallOrder;
    expect(entryCall).toBeLessThan(
      api.serviceAccount.checkIsWalletNotBackedUp.mock.invocationCallOrder[0],
    );
    expect(preSignCall).toBeLessThan(onPhase.mock.invocationCallOrder[0]);
    expect(onPhase.mock.invocationCallOrder[0]).toBeLessThan(
      api.serviceSend.signTransaction.mock.invocationCallOrder[0],
    );
    expect(onPhase).toHaveBeenCalledWith('signingMessage');
  });

  it('turns a dismissed password prompt into a user cancellation', async () => {
    api.serviceSend.signTransaction.mockRejectedValueOnce(
      new PasswordPromptDialogCancel(),
    );

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toBeInstanceOf(
      WcPayUserCancelledError,
    );
  });

  // The classification must come from the class and the code alone — never
  // from the message text, which is localized and vendor-supplied.
  it('turns a hardware cancellation whose message never mentions cancelling into a user cancellation', async () => {
    api.serviceSend.signTransaction.mockRejectedValueOnce(
      Object.assign(new Error('hd bridge returned 803'), {
        className: EOneKeyErrorClassNames.OneKeyHardwareError,
        code: HardwareErrorCode.ActionCancelled,
      }),
    );

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toBeInstanceOf(
      WcPayUserCancelledError,
    );
  });

  // The inverse of the message-text rule: an error that merely READS like a
  // rejection, with no cancel class and no cancel code, is a real failure.
  it('rethrows a rejection-sounding error that carries no cancel class or code', async () => {
    const sounded = new Error('User rejected the request');
    api.serviceSend.signTransaction.mockRejectedValueOnce(sounded);

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toBe(sounded);
  });

  it('rethrows other signing failures untouched', async () => {
    const boom = new Error('keyring exploded');
    api.serviceSend.signTransaction.mockRejectedValueOnce(boom);

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toBe(boom);
  });

  it('refuses a signed transaction whose message changed', async () => {
    api.serviceWalletConnectPay.isSolanaMessageUnchanged.mockResolvedValue(
      false,
    );

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toThrow(
      MISMATCH_MESSAGE,
    );
    expect(api.serviceSignature.addItemFromSendProcess).not.toHaveBeenCalled();
  });

  // The verdict is produced in the background and crosses the proxy, so it
  // is read strictly: a truthy non-boolean proves nothing about the message
  // surviving signing, and a transaction that may have changed under us must
  // never be submitted.
  it('refuses a non-boolean identity verdict from the background', async () => {
    api.serviceWalletConnectPay.isSolanaMessageUnchanged.mockResolvedValue(
      'yes',
    );

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toThrow(
      MISMATCH_MESSAGE,
    );
    expect(api.serviceSignature.addItemFromSendProcess).not.toHaveBeenCalled();
  });

  it('refuses a signing result that carries no raw transaction', async () => {
    api.serviceSend.signTransaction.mockResolvedValue({ txid: 'txid-1' });

    await expect(wcPayInlineSignSolanaTx(baseParams)).rejects.toThrow(
      MISMATCH_MESSAGE,
    );
    // nothing to compare against, so the identity check is never asked
    expect(
      api.serviceWalletConnectPay.isSolanaMessageUnchanged,
    ).not.toHaveBeenCalled();
    expect(api.serviceSignature.addItemFromSendProcess).not.toHaveBeenCalled();
  });

  it('keeps status ok when the signature record fails', async () => {
    api.serviceSignature.addItemFromSendProcess.mockRejectedValueOnce(
      new Error('db'),
    );

    await expect(wcPayInlineSignSolanaTx(baseParams)).resolves.toEqual({
      status: 'ok',
      rawTx: SIGNED_RAW_TX,
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('keeps status ok when the decoded tx cannot be built', async () => {
    api.serviceSend.buildDecodedTx.mockRejectedValueOnce(new Error('decode'));

    await expect(wcPayInlineSignSolanaTx(baseParams)).resolves.toEqual({
      status: 'ok',
      rawTx: SIGNED_RAW_TX,
    });
    expect(api.serviceSignature.addItemFromSendProcess).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
