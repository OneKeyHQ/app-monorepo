import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type { IUnsignedMessageEth } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PasswordPromptDialogCancel } from '@onekeyhq/shared/src/errors/errors/appErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { wcPayInlineSignTypedData } from '../wcPayInlineSignMessage';
import { WcPayUserCancelledError } from '../wcPayInlineUtils';

// yarn jest packages/kit/src/views/WalletConnectPay/hooks/__tests__/wcPayInlineSignMessage.test.ts

// The validator reaches for the address utils of every impl, which is far more
// module graph than this pipeline's contract needs; only its verdict matters
// here, so it is replaced by one whose verdict the tests control.
jest.mock('@onekeyhq/shared/src/utils/messageUtils', () => ({
  __esModule: true,
  validateTypedSignMessageDataV3V4: jest.fn(),
}));

// Every background method the pipeline touches must exist here: a missing one
// would throw a TypeError that the pre-sign try/catch reports as a validation
// fallback, hiding the behavior under test.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      checkIsWalletNotBackedUp: jest.fn(),
      getAccountAddressForApi: jest.fn(),
    },
    serviceNetwork: {
      getNetwork: jest.fn(),
    },
    serviceSend: {
      signMessage: jest.fn(),
    },
    serviceSignature: {
      addItemFromSignMessage: jest.fn(),
    },
  },
}));

// The mocked proxy re-typed as plain jest.Mock properties. Reading the real
// service types here would treat each entry as an unbound method, and the
// mock-configuring calls below would have no `mockResolvedValue` to reach for.
type IMockedService = Record<string, jest.Mock>;

const api = backgroundApiProxy as unknown as {
  serviceAccount: IMockedService;
  serviceNetwork: IMockedService;
  serviceSend: IMockedService;
  serviceSignature: IMockedService;
};

const { validateTypedSignMessageDataV3V4 } = jest.requireMock<{
  validateTypedSignMessageDataV3V4: jest.Mock;
}>('@onekeyhq/shared/src/utils/messageUtils');

const NETWORK_ID = 'evm--8453';
const ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
// Mixed case on purpose: the account binding below compares case-insensitively,
// which an all-numeric address could not prove.
const ACCOUNT_ADDRESS = '0xAbCdEf1111111111111111111111111111111111';
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222';
const SIGNATURE = '0xsig';
const MESSAGE = '{"types":{}}';
const GENERIC_ABORT_MESSAGE = 'This payment cannot be completed right now';

const sourceInfo: IDappSourceInfo = {
  id: '',
  origin: 'https://pay.walletconnect.com',
  hostname: 'pay.walletconnect.com',
  scope: 'ethereum',
  data: { method: 'eth_signTypedData_v4', params: [] },
  isWalletConnectRequest: false,
};

function buildOption(account: string): IWcPayOption {
  return {
    id: 'opt-1',
    account,
    amount: {
      unit: 'usdc',
      value: '1000000',
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
  accountAddress: ACCOUNT_ADDRESS,
  message: MESSAGE,
  option: buildOption(`eip155:8453:${ACCOUNT_ADDRESS}`),
  sourceInfo,
  throwIfCancelled,
  onPhase,
};

let consoleErrorSpy: jest.SpyInstance;

describe('wcPayInlineSignTypedData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Failures below are expected to be reported, not silently swallowed;
    // spying lets a test assert that while keeping the runner quiet.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateTypedSignMessageDataV3V4.mockResolvedValue(undefined);
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(false);
    api.serviceAccount.getAccountAddressForApi.mockResolvedValue(
      ACCOUNT_ADDRESS,
    );
    api.serviceNetwork.getNetwork.mockResolvedValue({
      impl: 'evm',
      chainId: '8453',
    });
    api.serviceSend.signMessage.mockResolvedValue(SIGNATURE);
    api.serviceSignature.addItemFromSignMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('signs with the modal-identical unsigned message and records history', async () => {
    const result = await wcPayInlineSignTypedData(baseParams);

    expect(result).toEqual({ status: 'ok', signature: SIGNATURE });
    expect(api.serviceSend.signMessage).toHaveBeenCalledWith({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      unsignedMessage: {
        type: EMessageTypesEth.TYPED_DATA_V4,
        message: MESSAGE,
        payload: [ACCOUNT_ADDRESS, MESSAGE],
      },
    });
    expect(onPhase).toHaveBeenCalledWith('signingMessage');
    expect(api.serviceSignature.addItemFromSignMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
        message: MESSAGE,
        sourceInfo,
      }),
    );
  });

  it('validates the very object it signs, against this network chain id', async () => {
    await wcPayInlineSignTypedData(baseParams);

    const [validatedMessage, validatedChainId, validatedImpl] =
      validateTypedSignMessageDataV3V4.mock.calls[0] as [
        IUnsignedMessageEth,
        string,
        string,
      ];
    const [signArgs] = api.serviceSend.signMessage.mock.calls[0] as [
      { unsignedMessage: IUnsignedMessageEth },
    ];

    // Reference identity, not a deep equal: two structurally equal objects
    // would pass a deep comparison while the pipeline validated one payload
    // and signed another.
    expect(validatedMessage).toBe(signArgs.unsignedMessage);
    expect([validatedChainId, validatedImpl]).toEqual(['8453', 'evm']);
  });

  it('aborts when the wallet is not backed up (the check shows its own dialog)', async () => {
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(true);

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'abort',
    });
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
    expect(onPhase).not.toHaveBeenCalled();
  });

  // The guard binds the order to the KEY behind accountId, so the address it
  // trusts is the one derived from that key — never a caller-supplied one.
  it('refuses to sign when the order names an account other than the signing key', async () => {
    await expect(
      wcPayInlineSignTypedData({
        ...baseParams,
        option: buildOption(`eip155:8453:${OTHER_ADDRESS}`),
      }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
    // the user-facing copy is generic, so the diagnostic is what tells this
    // guard apart from the other hard aborts
    expect(
      consoleErrorSpy.mock.calls
        .map((args: unknown[]) => args.map((arg) => String(arg)).join(' '))
        .join('\n'),
    ).toContain('wcPay inline account mismatch');
  });

  // payload[0] is the typed data's own `from`. If it is not the signing key,
  // the signature would carry an echoed sender the key does not back.
  it('refuses to sign when the payload address is not the signing key', async () => {
    await expect(
      wcPayInlineSignTypedData({
        ...baseParams,
        accountAddress: OTHER_ADDRESS,
      }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('refuses to sign when the signing key resolves to a third address', async () => {
    api.serviceAccount.getAccountAddressForApi.mockResolvedValue(OTHER_ADDRESS);

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toThrow(
      GENERIC_ABORT_MESSAGE,
    );
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('falls back when the signing account cannot be resolved', async () => {
    api.serviceAccount.getAccountAddressForApi.mockRejectedValueOnce(
      new Error('no account'),
    );

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'fallback',
      reason: 'no account',
    });
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('accepts an order and payload address that differ only in case', async () => {
    await expect(
      wcPayInlineSignTypedData({
        ...baseParams,
        accountAddress: ACCOUNT_ADDRESS.toUpperCase(),
        option: buildOption(`eip155:8453:${ACCOUNT_ADDRESS.toLowerCase()}`),
      }),
    ).resolves.toEqual({ status: 'ok', signature: SIGNATURE });
    expect(api.serviceSend.signMessage).toHaveBeenCalled();
  });

  it('turns a dismissed password prompt into a user cancellation', async () => {
    api.serviceSend.signMessage.mockRejectedValueOnce(
      new PasswordPromptDialogCancel(),
    );

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBeInstanceOf(
      WcPayUserCancelledError,
    );
  });

  // Both where the code sits and what the message says are part of the
  // fixture: hd-core raises some errors with a top-level `code` and others
  // with it nested under `payload`, and the classification must come from the
  // class and the code alone — never from the message text, which is
  // localized and vendor-supplied.
  it.each<[string, string, { code: number } | { payload: { code: number } }]>([
    [
      'ActionCancelled',
      'cancelled on device',
      { code: HardwareErrorCode.ActionCancelled },
    ],
    [
      'PinCancelled',
      'cancelled on device',
      { code: HardwareErrorCode.PinCancelled },
    ],
    [
      'CallQueueActionCancelled',
      'cancelled on device',
      { code: HardwareErrorCode.CallQueueActionCancelled },
    ],
    [
      'ActionCancelled carried under payload',
      'cancelled on device',
      { payload: { code: HardwareErrorCode.ActionCancelled } },
    ],
    [
      'ActionCancelled whose message never mentions cancelling',
      'hd bridge returned 803',
      { code: HardwareErrorCode.ActionCancelled },
    ],
  ])(
    'turns a hardware %s into a user cancellation',
    async (_name, message, codeProps) => {
      api.serviceSend.signMessage.mockRejectedValueOnce(
        Object.assign(new Error(message), {
          className: EOneKeyErrorClassNames.OneKeyHardwareError,
          ...codeProps,
        }),
      );

      await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBeInstanceOf(
        WcPayUserCancelledError,
      );
    },
  );

  it('rethrows a hardware failure that is not a cancellation', async () => {
    const notFound = Object.assign(new Error('device not found'), {
      className: EOneKeyErrorClassNames.OneKeyHardwareError,
      code: HardwareErrorCode.DeviceNotFound,
    });
    api.serviceSend.signMessage.mockRejectedValueOnce(notFound);

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBe(notFound);
  });

  // The inverse of the message-text rule: an error that merely READS like a
  // rejection, with no cancel class and no cancel code, is a real failure.
  it('rethrows a rejection-sounding error that carries no cancel class or code', async () => {
    const sounded = new Error('User rejected the request');
    api.serviceSend.signMessage.mockRejectedValueOnce(sounded);

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBe(sounded);
  });

  it('rethrows other signing failures untouched', async () => {
    const boom = new Error('keyring exploded');
    api.serviceSend.signMessage.mockRejectedValueOnce(boom);

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBe(boom);
  });

  it('falls back when pre-sign validation throws', async () => {
    validateTypedSignMessageDataV3V4.mockRejectedValueOnce(
      new Error('bad domain'),
    );

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'fallback',
      reason: 'bad domain',
    });
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('preserves a thrown string as the fallback reason', async () => {
    validateTypedSignMessageDataV3V4.mockRejectedValueOnce(
      'bare string reject',
    );

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'fallback',
      reason: 'bare string reject',
    });
  });

  it('falls back with a default reason when the rejection carries no message', async () => {
    validateTypedSignMessageDataV3V4.mockRejectedValueOnce(undefined);

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'fallback',
      reason: 'typed data validation failed',
    });
  });

  it('falls back when the network cannot be resolved', async () => {
    api.serviceNetwork.getNetwork.mockRejectedValueOnce(
      new Error('unknown network'),
    );

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'fallback',
      reason: 'unknown network',
    });
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('keeps status ok when the history write fails', async () => {
    api.serviceSignature.addItemFromSignMessage.mockRejectedValueOnce(
      new Error('db'),
    );

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'ok',
      signature: SIGNATURE,
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // The backup check raises a dialog as a side effect, so an already-cancelled
  // flow must be stopped before it, not after.
  it('stops on entry without running the backup check', async () => {
    const cancelled = new WcPayUserCancelledError('x');
    throwIfCancelled.mockImplementationOnce(() => {
      throw cancelled;
    });

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBe(cancelled);
    expect(api.serviceAccount.checkIsWalletNotBackedUp).not.toHaveBeenCalled();
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('propagates a cancellation raised at the last pre-sign gate', async () => {
    const cancelled = new WcPayUserCancelledError('x');
    throwIfCancelled
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw cancelled;
      });

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBe(cancelled);
    expect(api.serviceAccount.checkIsWalletNotBackedUp).toHaveBeenCalled();
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('checks for cancellation on entry and again after validation, before announcing the phase', async () => {
    await wcPayInlineSignTypedData(baseParams);

    expect(throwIfCancelled).toHaveBeenCalledTimes(2);
    const [entryCall, preSignCall] = throwIfCancelled.mock.invocationCallOrder;
    expect(entryCall).toBeLessThan(
      api.serviceAccount.checkIsWalletNotBackedUp.mock.invocationCallOrder[0],
    );
    expect(preSignCall).toBeGreaterThan(
      validateTypedSignMessageDataV3V4.mock.invocationCallOrder[0],
    );
    expect(preSignCall).toBeLessThan(onPhase.mock.invocationCallOrder[0]);
  });
});
