import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PasswordPromptDialogCancel } from '@onekeyhq/shared/src/errors/errors/appErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
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
const ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111';
const SIGNATURE = '0xsig';
const MESSAGE = '{"types":{}}';

const sourceInfo: IDappSourceInfo = {
  id: '',
  origin: 'https://pay.walletconnect.com',
  hostname: 'pay.walletconnect.com',
  scope: 'ethereum',
  data: { method: 'eth_signTypedData_v4', params: [] },
  isWalletConnectRequest: false,
};

const throwIfCancelled = jest.fn();
const onPhase = jest.fn();

const baseParams = {
  networkId: NETWORK_ID,
  accountId: ACCOUNT_ID,
  accountAddress: ACCOUNT_ADDRESS,
  message: MESSAGE,
  sourceInfo,
  throwIfCancelled,
  onPhase,
};

let consoleErrorSpy: jest.SpyInstance;

describe('wcPayInlineSignTypedData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The bookkeeping failure below is expected to be reported, not silently
    // swallowed; spying lets a test assert that while keeping the runner quiet.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateTypedSignMessageDataV3V4.mockResolvedValue(undefined);
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(false);
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

  it('validates the same unsigned message it signs, against this network chain id', async () => {
    await wcPayInlineSignTypedData(baseParams);

    expect(validateTypedSignMessageDataV3V4).toHaveBeenCalledWith(
      {
        type: EMessageTypesEth.TYPED_DATA_V4,
        message: MESSAGE,
        payload: [ACCOUNT_ADDRESS, MESSAGE],
      },
      '8453',
      'evm',
    );
  });

  it('aborts when the wallet is not backed up (the check shows its own dialog)', async () => {
    api.serviceAccount.checkIsWalletNotBackedUp.mockResolvedValue(true);

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'abort',
    });
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
    expect(onPhase).not.toHaveBeenCalled();
  });

  it('turns a dismissed password prompt into a user cancellation', async () => {
    api.serviceSend.signMessage.mockRejectedValueOnce(
      new PasswordPromptDialogCancel(),
    );

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBeInstanceOf(
      WcPayUserCancelledError,
    );
  });

  // Where the code sits is part of the fixture: hd-core raises some errors
  // with a top-level `code` and others with it nested under `payload`, and the
  // detector has to recognize both.
  it.each<[string, { code: number } | { payload: { code: number } }]>([
    ['ActionCancelled', { code: HardwareErrorCode.ActionCancelled }],
    ['PinCancelled', { code: HardwareErrorCode.PinCancelled }],
    [
      'CallQueueActionCancelled',
      { code: HardwareErrorCode.CallQueueActionCancelled },
    ],
    [
      'ActionCancelled carried under payload',
      { payload: { code: HardwareErrorCode.ActionCancelled } },
    ],
  ])(
    'turns a hardware %s into a user cancellation',
    async (_name, codeProps) => {
      api.serviceSend.signMessage.mockRejectedValueOnce(
        Object.assign(new Error('cancelled on device'), {
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

  it('does not swallow history write failures into the result', async () => {
    api.serviceSignature.addItemFromSignMessage.mockRejectedValueOnce(
      new Error('db'),
    );

    await expect(wcPayInlineSignTypedData(baseParams)).resolves.toEqual({
      status: 'ok',
      signature: SIGNATURE,
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('propagates a cancellation raised before signing without signing', async () => {
    const cancelled = new WcPayUserCancelledError('x');
    throwIfCancelled.mockImplementationOnce(() => {
      throw cancelled;
    });

    await expect(wcPayInlineSignTypedData(baseParams)).rejects.toBe(cancelled);
    expect(api.serviceSend.signMessage).not.toHaveBeenCalled();
  });

  it('checks for cancellation after validation and before announcing the phase', async () => {
    await wcPayInlineSignTypedData(baseParams);

    expect(throwIfCancelled).toHaveBeenCalledTimes(1);
    expect(throwIfCancelled.mock.invocationCallOrder[0]).toBeGreaterThan(
      validateTypedSignMessageDataV3V4.mock.invocationCallOrder[0],
    );
    expect(throwIfCancelled.mock.invocationCallOrder[0]).toBeLessThan(
      onPhase.mock.invocationCallOrder[0],
    );
  });
});
