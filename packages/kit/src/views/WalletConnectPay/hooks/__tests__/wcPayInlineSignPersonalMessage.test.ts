import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PasswordPromptDialogCancel } from '@onekeyhq/shared/src/errors/errors/appErrors';
import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { wcPayInlineSignPersonalMessage } from '../wcPayInlineSignPersonalMessage';
import {
  WC_PAY_PERSONAL_SIGN_MIN_DISPLAY_MS,
  WcPayUserCancelledError,
} from '../wcPayInlineUtils';

// yarn jest packages/kit/src/views/WalletConnectPay/hooks/__tests__/wcPayInlineSignPersonalMessage.test.ts

// wcPayInlineUtils imports messageUtils (for the plan gate this suite never
// calls), which transitively pulls @ethereumjs/util → @noble; stub the module
// so the pipeline's own contract is all that loads.
jest.mock('@onekeyhq/shared/src/utils/messageUtils', () => ({
  __esModule: true,
  autoFixPersonalSignMessage: jest.fn(
    ({ message }: { message: string }) => message,
  ),
  validateTypedSignMessageDataV3V4: jest.fn(),
}));

// The display dwell is a real wall-clock wait in production; only `wait` is
// stubbed (other transitive consumers call the module at import time) so the
// suite stays fast while the dwell's placement is asserted.
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<{
    default: Record<string, unknown>;
  }>('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      wait: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// Every background method the pipeline touches must exist here: a missing one
// would throw a TypeError that the pre-sign try/catch reports as a fallback,
// hiding the behavior under test.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      checkIsWalletNotBackedUp: jest.fn(),
      getAccountAddressForApi: jest.fn(),
    },
    serviceSend: {
      signMessage: jest.fn(),
    },
    serviceSignature: {
      addItemFromSignMessage: jest.fn(),
    },
  },
}));

type IMockedService = Record<string, jest.Mock>;

const api = backgroundApiProxy as unknown as {
  serviceAccount: IMockedService;
  serviceSend: IMockedService;
  serviceSignature: IMockedService;
};

const NETWORK_ID = 'evm--8453';
const ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
// Mixed case on purpose: the account binding below compares case-insensitively,
// which an all-numeric address could not prove.
const ACCOUNT_ADDRESS = '0xAbCdEf1111111111111111111111111111111111';
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222';
const SIGNATURE = '0xsig';
const MESSAGE = '0x506179206f726465722023313233'; // "Pay order #123"
const GENERIC_ABORT_MESSAGE = 'This payment cannot be completed right now';

const sourceInfo: IDappSourceInfo = {
  id: '',
  origin: 'https://pay.walletconnect.com',
  hostname: 'pay.walletconnect.com',
  scope: 'ethereum',
  data: { method: 'personal_sign', params: [] },
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

describe('wcPayInlineSignPersonalMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(false);
    api.serviceAccount.getAccountAddressForApi.mockResolvedValue(
      ACCOUNT_ADDRESS,
    );
    api.serviceSend.signMessage.mockResolvedValue(SIGNATURE);
    api.serviceSignature.addItemFromSignMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('signs with the modal-identical unsigned message and records history', async () => {
    const result = await wcPayInlineSignPersonalMessage(baseParams);

    expect(result).toEqual({ status: 'ok', signature: SIGNATURE });
    expect(api.serviceSend.signMessage).toHaveBeenCalledWith({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      unsignedMessage: {
        type: EMessageTypesEth.PERSONAL_SIGN,
        message: MESSAGE,
        // personal_sign payload order is [message, address] — the reverse of
        // the typed-data payload — and the executor's modal push pins the
        // same order
        payload: [MESSAGE, ACCOUNT_ADDRESS],
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

  it('aborts when the wallet is not backed up (the check shows its own dialog)', async () => {
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(true);

    await expect(wcPayInlineSignPersonalMessage(baseParams)).resolves.toEqual({
      status: 'abort',
    });
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
    expect(onPhase).not.toHaveBeenCalled();
  });

  it('refuses to sign when the order names an account other than the signing key', async () => {
    await expect(
      wcPayInlineSignPersonalMessage({
        ...baseParams,
        option: buildOption(`eip155:8453:${OTHER_ADDRESS}`),
      }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
    expect(
      consoleErrorSpy.mock.calls
        .map((args: unknown[]) => args.map((arg) => String(arg)).join(' '))
        .join('\n'),
    ).toContain('wcPay inline account mismatch');
  });

  // payload[1] is the echoed signer. If it is not the signing key, the
  // signed payload would lie about who signed.
  it('refuses to sign when the payload address is not the signing key', async () => {
    await expect(
      wcPayInlineSignPersonalMessage({
        ...baseParams,
        accountAddress: OTHER_ADDRESS,
      }),
    ).rejects.toThrow(GENERIC_ABORT_MESSAGE);
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('refuses to sign when the signing key resolves to a third address', async () => {
    api.serviceAccount.getAccountAddressForApi.mockResolvedValue(OTHER_ADDRESS);

    await expect(wcPayInlineSignPersonalMessage(baseParams)).rejects.toThrow(
      GENERIC_ABORT_MESSAGE,
    );
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('falls back when the signing account cannot be resolved', async () => {
    api.serviceAccount.getAccountAddressForApi.mockRejectedValueOnce(
      new Error('no account'),
    );

    await expect(wcPayInlineSignPersonalMessage(baseParams)).resolves.toEqual({
      status: 'fallback',
      reason: 'no account',
    });
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('accepts an order and payload address that differ only in case', async () => {
    await expect(
      wcPayInlineSignPersonalMessage({
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

    await expect(
      wcPayInlineSignPersonalMessage(baseParams),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
  });

  it('turns a hardware cancel code into a user cancellation', async () => {
    api.serviceSend.signMessage.mockRejectedValueOnce({
      $isHardwareError: true,
      payload: { code: HardwareErrorCode.ActionCancelled },
    });

    await expect(
      wcPayInlineSignPersonalMessage(baseParams),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
  });

  it('rethrows any other signing failure untouched', async () => {
    const boom = new Error('device exploded');
    api.serviceSend.signMessage.mockRejectedValueOnce(boom);

    await expect(wcPayInlineSignPersonalMessage(baseParams)).rejects.toBe(boom);
  });

  it('still succeeds when the history write fails', async () => {
    api.serviceSignature.addItemFromSignMessage.mockRejectedValueOnce(
      new Error('db closed'),
    );

    await expect(wcPayInlineSignPersonalMessage(baseParams)).resolves.toEqual({
      status: 'ok',
      signature: SIGNATURE,
    });
  });

  it('checks cancellation before the backup check can raise its dialog', async () => {
    throwIfCancelled.mockImplementationOnce(() => {
      throw new WcPayUserCancelledError('User canceled payment');
    });

    await expect(
      wcPayInlineSignPersonalMessage(baseParams),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
    expect(api.serviceAccount.checkIsWalletNotBackedUp).not.toHaveBeenCalled();
  });
});

describe('wcPayInlineSignPersonalMessage display dwell', () => {
  const timerUtils = jest.requireMock<{
    default: { wait: jest.Mock };
  }>('@onekeyhq/shared/src/utils/timerUtils').default;

  beforeEach(() => {
    jest.clearAllMocks();
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(false);
    api.serviceAccount.getAccountAddressForApi.mockResolvedValue(
      ACCOUNT_ADDRESS,
    );
    api.serviceSend.signMessage.mockResolvedValue(SIGNATURE);
    api.serviceSignature.addItemFromSignMessage.mockResolvedValue(undefined);
    timerUtils.wait.mockResolvedValue(undefined);
  });

  it('holds the message on screen before requesting the signature', async () => {
    await wcPayInlineSignPersonalMessage(baseParams);

    expect(timerUtils.wait).toHaveBeenCalledWith(
      WC_PAY_PERSONAL_SIGN_MIN_DISPLAY_MS,
    );
    // dwell strictly precedes the signature request — display-before-sign
    // is this leg's whole consent contract
    expect(timerUtils.wait.mock.invocationCallOrder[0]).toBeLessThan(
      api.serviceSend.signMessage.mock.invocationCallOrder[0],
    );
  });

  it('still cancels unsigned when the page closes during the dwell', async () => {
    timerUtils.wait.mockImplementationOnce(async () => {
      throwIfCancelled.mockImplementationOnce(() => {
        throw new WcPayUserCancelledError('User canceled payment');
      });
    });

    await expect(
      wcPayInlineSignPersonalMessage(baseParams),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });
});
