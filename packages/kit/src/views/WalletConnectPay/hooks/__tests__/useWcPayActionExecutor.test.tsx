/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react-native';

import { EWcPayActionMethod } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type {
  IWcPayAction,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import { useWcPayActionExecutor } from '../useWcPayActionExecutor';

import type { IWcPayInlineController } from '../wcPayInlineUtils';

// messageUtils transitively imports @ethereumjs/util → @noble, which needs
// TextEncoder at import time and jsdom provides none; the fixer's behavior
// is irrelevant to the parking choreography under test
jest.mock('@onekeyhq/shared/src/utils/messageUtils', () => ({
  __esModule: true,
  autoFixPersonalSignMessage: ({ message }: { message: string }) => message,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const services = {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn().mockResolvedValue('default'),
    },
    serviceAccount: {
      getNetworkAccount: jest.fn().mockResolvedValue({
        id: 'account-1',
        address: '0x1111111111111111111111111111111111111111',
      }),
    },
    serviceSend: {
      prepareSendConfirmUnsignedTx: jest
        .fn()
        .mockResolvedValue({ encodedTx: {} }),
    },
    serviceWalletConnectPay: {
      waitForTxMined: jest.fn().mockResolvedValue({ isReverted: false }),
      isTxNeverBroadcast: jest.fn().mockResolvedValue(false),
      getBroadcastMetaByTxid: jest.fn().mockResolvedValue(undefined),
    },
  };
  return { __esModule: true, default: services };
});

// the headless pipeline itself is covered by wcPayInlineSendTx.test.ts; here
// it is mocked so these tests drive the executor's sequence bookkeeping
jest.mock('../wcPayInlineSendTx', () => ({
  __esModule: true,
  wcPayInlineSendTx: jest.fn(),
}));

// what the executor's four confirm-modal push sites hand to navigation —
// only the fields this test interacts with
interface IStubConfirmParams {
  unsignedMessage?: unknown;
  onSuccess: (result: unknown) => void;
}

const pushModalMock = jest.fn<
  void,
  [unknown, { params: IStubConfirmParams }]
>();
jest.mock('../../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: pushModalMock }),
}));

function buildAction({
  method,
  params,
  chainId = 'eip155:1',
}: {
  method: EWcPayActionMethod;
  params: unknown;
  chainId?: string;
}): IWcPayAction {
  return {
    walletRpc: { chainId, method, params: JSON.stringify(params) },
  };
}

type IControllerStub = IWcPayInlineController & {
  onBeforePushConfirmModal: jest.Mock<void, []>;
  onAfterConfirmModalSettled: jest.Mock<void, []>;
};

function buildController(): IControllerStub {
  return {
    onPhase: jest.fn(),
    onInlineFailure: jest.fn().mockResolvedValue('abort'),
    onFallback: jest.fn(),
    onBeforePushConfirmModal: jest.fn<void, []>(),
    onAfterConfirmModalSettled: jest.fn<void, []>(),
  };
}

describe('useWcPayActionExecutor confirm-modal parking', () => {
  beforeEach(() => {
    pushModalMock.mockReset();
  });

  // Every executor branch that pushes a confirm modal must first give the
  // host dialog a chance to park itself: the WC Pay dialog is a system-level
  // sheet that renders ABOVE the pushed RN-layer confirm page and is
  // non-dismissible during the paying phase, so a missed park is an
  // unrecoverable deadlock (P0 review finding on PR #12590).
  const cases: Array<{
    label: string;
    action: IWcPayAction;
    settle: (params: IStubConfirmParams) => void;
    expected: string;
  }> = [
    {
      label: 'personal_sign',
      action: buildAction({
        method: EWcPayActionMethod.PersonalSign,
        params: ['0xdeadbeef', '0x1111111111111111111111111111111111111111'],
      }),
      settle: (params) => params.onSuccess('0xsig-personal'),
      expected: '0xsig-personal',
    },
    {
      label: 'eth_signTypedData_v4',
      action: buildAction({
        method: EWcPayActionMethod.EthSignTypedDataV4,
        params: [
          '0x1111111111111111111111111111111111111111',
          JSON.stringify({
            types: { EIP712Domain: [], Permit: [] },
            domain: {},
            primaryType: 'Permit',
            message: {},
          }),
        ],
      }),
      settle: (params) => params.onSuccess('0xsig-typed'),
      expected: '0xsig-typed',
    },
    {
      label: 'eth_sendTransaction without an inline plan',
      action: buildAction({
        method: EWcPayActionMethod.EthSendTransaction,
        params: [{ from: '0x1', to: '0x2', value: '0x0' }],
      }),
      settle: (params) =>
        params.onSuccess([{ signedTx: { txid: '0xtxid-fallback' } }]),
      expected: '0xtxid-fallback',
    },
  ];

  it.each(cases)(
    'parks the dialog before pushing the $label confirm modal',
    async ({ action, settle, expected }) => {
      const controller = buildController();
      const callOrder: string[] = [];
      controller.onBeforePushConfirmModal.mockImplementation(() => {
        callOrder.push('park');
      });
      controller.onAfterConfirmModalSettled.mockImplementation(() => {
        callOrder.push('settle');
      });
      pushModalMock.mockImplementation((_route, { params }) => {
        callOrder.push('pushModal');
        settle(params);
      });

      const { result } = renderHook(() => useWcPayActionExecutor());
      const signatures = await result.current.executeActions({
        actions: [action],
        accountId: 'account-1',
        // no `option`: the eth_sendTransaction case must reach the confirm
        // modal WITHOUT entering the inline attempts loop, proving the park
        // does not depend on the inline fallback path
        inlineController: controller,
      });

      expect(signatures).toEqual([expected]);
      expect(controller.onBeforePushConfirmModal).toHaveBeenCalledTimes(1);
      expect(pushModalMock).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['park', 'pushModal', 'settle']);
    },
  );

  it('parks before every confirm modal of a multi-action sequence and reveals between them', async () => {
    const controller = buildController();
    const callOrder: string[] = [];
    controller.onBeforePushConfirmModal.mockImplementation(() => {
      callOrder.push('park');
    });
    controller.onAfterConfirmModalSettled.mockImplementation(() => {
      callOrder.push('settle');
    });
    pushModalMock.mockImplementation((_route, { params }) => {
      callOrder.push('pushModal');
      if (params.unsignedMessage) {
        params.onSuccess('0xsig-permit');
      } else {
        params.onSuccess([{ signedTx: { txid: '0xtxid-transfer' } }]);
      }
    });

    const { result } = renderHook(() => useWcPayActionExecutor());
    const signatures = await result.current.executeActions({
      actions: [
        buildAction({
          method: EWcPayActionMethod.EthSignTypedDataV4,
          params: [
            '0x1111111111111111111111111111111111111111',
            JSON.stringify({
              types: { EIP712Domain: [], Permit: [] },
              domain: {},
              primaryType: 'Permit',
              message: {},
            }),
          ],
        }),
        buildAction({
          method: EWcPayActionMethod.EthSendTransaction,
          params: [{ from: '0x1', to: '0x2', value: '0x0' }],
        }),
      ],
      accountId: 'account-1',
      inlineController: controller,
    });

    expect(signatures).toEqual(['0xsig-permit', '0xtxid-transfer']);
    // the settle between the two parks is what keeps the paying progress on
    // screen through the between-action stretch (P2 review finding: Permit2's
    // mined-wait ran for minutes over a blank screen with the parked dialog
    // swallowing new payment scans)
    expect(callOrder).toEqual([
      'park',
      'pushModal',
      'settle',
      'park',
      'pushModal',
      'settle',
    ]);
  });

  it('reveals the dialog when a confirm modal settles by failing', async () => {
    const controller = buildController();
    pushModalMock.mockImplementation((_route, { params }) => {
      (params as unknown as { onFail: (e: Error) => void }).onFail(
        new Error('signing failed'),
      );
    });

    const { result } = renderHook(() => useWcPayActionExecutor());
    await expect(
      result.current.executeActions({
        actions: [
          buildAction({
            method: EWcPayActionMethod.PersonalSign,
            params: ['0xdeadbeef'],
          }),
        ],
        accountId: 'account-1',
        inlineController: controller,
      }),
    ).rejects.toThrow('signing failed');
    expect(controller.onAfterConfirmModalSettled).toHaveBeenCalledTimes(1);
  });

  it('does not require the controller: absent hook falls back to plain pushModal', async () => {
    pushModalMock.mockImplementation((_route, { params }) => {
      params.onSuccess('0xsig-personal');
    });
    const { result } = renderHook(() => useWcPayActionExecutor());
    const signatures = await result.current.executeActions({
      actions: [
        buildAction({
          method: EWcPayActionMethod.PersonalSign,
          params: ['0xdeadbeef'],
        }),
      ],
      accountId: 'account-1',
    });
    expect(signatures).toEqual(['0xsig-personal']);
  });
});

describe('useWcPayActionExecutor sequence invariants', () => {
  const SENDER = '0x1111111111111111111111111111111111111111';
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
  // shaped to match `option` exactly, so getWcPayInlineTxPlan admits it
  const buildTransferAction = () =>
    buildAction({
      method: EWcPayActionMethod.EthSendTransaction,
      params: [{ from: SENDER, to: SENDER, value: '0xf4240' }],
      chainId: 'eip155:8453',
    });
  const typedDataAction = buildAction({
    method: EWcPayActionMethod.EthSignTypedDataV4,
    params: [
      SENDER,
      JSON.stringify({
        types: { EIP712Domain: [], Permit: [] },
        domain: {},
        primaryType: 'Permit',
        message: {},
      }),
    ],
    chainId: 'eip155:8453',
  });

  const services = jest.requireMock<{
    default: {
      serviceWalletConnectPay: {
        waitForTxMined: jest.Mock;
        isTxNeverBroadcast: jest.Mock;
        getBroadcastMetaByTxid: jest.Mock;
      };
    };
  }>('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
  const { waitForTxMined, isTxNeverBroadcast } =
    services.serviceWalletConnectPay;
  const { wcPayInlineSendTx } = jest.requireMock<{
    wcPayInlineSendTx: jest.Mock;
  }>('../wcPayInlineSendTx');

  beforeEach(() => {
    pushModalMock.mockReset();
    waitForTxMined.mockReset();
    waitForTxMined.mockResolvedValue({ isReverted: false });
    isTxNeverBroadcast.mockReset();
    isTxNeverBroadcast.mockResolvedValue(false);
    wcPayInlineSendTx.mockReset();
    wcPayInlineSendTx.mockResolvedValue({ status: 'ok', txid: '0xinline' });
    // every confirm modal settles successfully, whichever kind it is
    pushModalMock.mockImplementation((_route, { params }) => {
      if (params.unsignedMessage) {
        params.onSuccess('0xsig-permit');
      } else {
        params.onSuccess([{ signedTx: { txid: '0xtxid-confirm' } }]);
      }
    });
  });

  // C1: an inlined broadcast must join the same post-action path as a
  // confirm-page one — the mined-wait is what orders Permit2's approve
  // before the follow-up signature.
  it('waits for an inlined broadcast to mine before the next action', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());
    const signatures = await result.current.executeActions({
      actions: [buildTransferAction(), typedDataAction],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(1);
    expect(waitForTxMined).toHaveBeenCalledTimes(1);
    expect(waitForTxMined).toHaveBeenCalledWith({
      networkId: 'evm--8453',
      txid: '0xinline',
    });
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xinline', '0xsig-permit']);
  });

  it('invalidates an inlined action whose transaction reverted', async () => {
    waitForTxMined.mockResolvedValue({ isReverted: true });
    const onActionInvalidated = jest.fn();
    const { result } = renderHook(() => useWcPayActionExecutor());

    await expect(
      result.current.executeActions({
        actions: [buildTransferAction(), typedDataAction],
        accountId: 'account-1',
        option,
        inlineController: buildController(),
        onActionInvalidated,
      }),
    ).rejects.toThrow('Transaction reverted on chain');
    expect(onActionInvalidated).toHaveBeenCalledTimes(1);
    expect(onActionInvalidated).toHaveBeenCalledWith({ index: 0 });
    // the follow-up signature must never be requested after a revert
    expect(pushModalMock).not.toHaveBeenCalled();
  });

  // C2: N equal transfers must not become N headless broadcasts.
  it('inlines only the first spend of a repeated-transfer sequence', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [
        buildTransferAction(),
        buildTransferAction(),
        buildTransferAction(),
      ],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(1);
    expect(pushModalMock).toHaveBeenCalledTimes(2);
    expect(signatures).toEqual([
      '0xinline',
      '0xtxid-confirm',
      '0xtxid-confirm',
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      'inline spend budget exhausted',
    );
    warnSpy.mockRestore();
  });

  // The seeding must follow the index the loop actually starts from: a
  // rolled-back action is re-executed in THIS run, so its earlier spend is
  // not spent any more. Seeding from the raw stored length instead would
  // silently refuse to inline the very action being re-executed.
  it('re-inlines an action the resume probe rolled back', async () => {
    isTxNeverBroadcast.mockResolvedValue(true);
    const onActionInvalidated = jest.fn();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildTransferAction(), typedDataAction],
      accountId: 'account-1',
      // recorded by an earlier run, but never actually broadcast
      completedResults: ['0xtxid-prev'],
      option,
      inlineController: buildController(),
      onActionInvalidated,
    });

    expect(onActionInvalidated).toHaveBeenCalledWith({ index: 0 });
    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xinline', '0xsig-permit']);
  });

  it("counts a resumed run's completed spend against the budget", async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildTransferAction(), buildTransferAction()],
      accountId: 'account-1',
      // the first action was already paid for in an earlier run
      completedResults: ['0xearlier'],
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xearlier', '0xtxid-confirm']);
  });
});
