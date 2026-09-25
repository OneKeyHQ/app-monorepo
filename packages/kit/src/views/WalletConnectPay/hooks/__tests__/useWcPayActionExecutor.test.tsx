/**
 * @jest-environment jsdom
 */
// cspell:ignore inlines

import { renderHook } from '@testing-library/react-native';

import { EWcPayActionMethod } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type {
  IWcPayAction,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  WC_PAY_INLINE_APPROVE_BUDGET_REASON,
  WC_PAY_INLINE_BUDGET_REASON,
  WC_PAY_INLINE_PERSONAL_SIGN_BUDGET_REASON,
  useWcPayActionExecutor,
} from '../useWcPayActionExecutor';
import {
  EWcPayInlineFailureKind,
  WC_PAY_INLINE_POST_SIGN_FLAG,
  WC_PAY_PERMIT_MAX_DEADLINE_S,
  WcPayUserCancelledError,
} from '../wcPayInlineUtils';

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
      // The suites' native-transfer fixtures display USDC with 6 decimals, so
      // the mock network's native asset agrees — the transfer gate's happy
      // path. The gate's own suite overrides this per test.
      getNetwork: jest
        .fn()
        .mockResolvedValue({ id: 'evm--8453', symbol: 'USDC', decimals: 6 }),
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
    serviceToken: {
      fetchTokensDetails: jest.fn().mockResolvedValue([]),
    },
    serviceWalletConnectPay: {
      waitForTxMined: jest.fn().mockResolvedValue({ isReverted: false }),
      isTxNeverBroadcast: jest.fn().mockResolvedValue(false),
      getBroadcastMetaByTxid: jest.fn().mockResolvedValue(undefined),
      // the Solana order check lives in the background because it decodes the
      // blob with @solana/web3.js, which must not enter this bundle
      checkSolanaTxMatchesOrder: jest.fn(),
    },
  };
  return { __esModule: true, default: services };
});

// the headless pipelines have their own suites (wcPayInlineSendTx.test.ts,
// wcPayInlineSignMessage.test.ts, wcPayInlineSignSolana.test.ts); here they
// are mocked so these tests drive the executor's own wiring and bookkeeping
jest.mock('../wcPayInlineSendTx', () => ({
  __esModule: true,
  wcPayInlineSendTx: jest.fn(),
}));
jest.mock('../wcPayInlineSignMessage', () => ({
  __esModule: true,
  wcPayInlineSignTypedData: jest.fn(),
}));
jest.mock('../wcPayInlineSignPersonalMessage', () => ({
  __esModule: true,
  wcPayInlineSignPersonalMessage: jest.fn(),
}));
jest.mock('../wcPayInlineSignSolana', () => ({
  __esModule: true,
  wcPayInlineSignSolanaTx: jest.fn(),
}));

// The executor's own arithmetic for the permit deadline bound is observable
// only in what it hands the plan gate, and the gate's exported binding cannot
// be spied on (an ES module export is not configurable). So the leaf module is
// mocked PARTIALLY: every export keeps its real implementation — the plans
// below still decide for real — and the message plan additionally records its
// arguments.
//
// This relies on the jest config enabling neither `resetMocks` nor
// `restoreMocks`: either would wipe the implementation this factory installed
// and leave the gate answering `undefined`, which reads as "no plan" rather
// than as a broken mock. Whoever turns one on has to give the gate its
// implementation back per test.
jest.mock('../wcPayInlineUtils', () => {
  const actual = jest.requireActual<typeof import('../wcPayInlineUtils')>(
    '../wcPayInlineUtils',
  );
  return {
    __esModule: true,
    ...actual,
    getWcPayInlineMessagePlan: jest.fn(actual.getWcPayInlineMessagePlan),
  };
});

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
  onPhase: jest.Mock;
  onSigningSummary: jest.Mock;
  onInlineFailure: jest.Mock;
  onFallback: jest.Mock<void, []>;
  onBeforePushConfirmModal: jest.Mock<void, []>;
  onAfterConfirmModalSettled: jest.Mock<void, []>;
};

function buildController(): IControllerStub {
  return {
    onPhase: jest.fn(),
    onSigningSummary: jest.fn(),
    onInlineFailure: jest.fn().mockResolvedValue('abort'),
    onFallback: jest.fn<void, []>(),
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
  const solanaAction = buildAction({
    method: EWcPayActionMethod.SolanaSignTransaction,
    params: [{ transaction: 'dW5zaWduZWQ=' }],
    chainId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
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
    // ordering, not just counts: the approve has to be MINED before the
    // follow-up signature is requested, which is the whole reason the inlined
    // broadcast joins the confirm page's post-broadcast tail
    expect(waitForTxMined.mock.invocationCallOrder[0]).toBeLessThan(
      pushModalMock.mock.invocationCallOrder[0],
    );
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
    // the budget refusal is reported at error level: a sequence asking for a
    // second inline spend is louder than any single pipeline falling back
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(errorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_BUDGET_REASON,
    );
    errorSpy.mockRestore();
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

  // Fail-closed seeding for the two shapes stored progress cannot judge:
  // nothing records HOW a completed action was signed, and both of these are
  // inline-eligible spends, so a resumed sequence must treat them as spent
  // rather than hand its budget to a later action.
  it("counts a resumed run's completed permit against the budget", async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [typedDataAction, buildTransferAction()],
      accountId: 'account-1',
      // signed in an earlier run, possibly inline
      completedResults: ['0xsig-earlier'],
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xsig-earlier', '0xtxid-confirm']);
    expect(errorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_BUDGET_REASON,
    );
    errorSpy.mockRestore();
  });

  it("counts a resumed run's completed Solana signature against the budget", async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [solanaAction, buildTransferAction()],
      accountId: 'account-1',
      // signed in an earlier run, possibly inline
      completedResults: ['rawtx-earlier'],
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['rawtx-earlier', '0xtxid-confirm']);
    expect(errorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_BUDGET_REASON,
    );
    errorSpy.mockRestore();
  });
});

describe('useWcPayActionExecutor inline signing', () => {
  const SENDER = '0x1111111111111111111111111111111111111111';
  const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  // canonical Permit2 deployment — the only verifyingContract the validator
  // accepts
  const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
  const SOL_CHAIN = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
  const SOL_PAYER = 'payer';
  const SOL_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const SOL_TX_BASE64 = 'dW5zaWduZWQ=';

  const permitTypedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      PermitTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
    primaryType: 'PermitTransferFrom',
    domain: { name: 'Permit2', chainId: 8453, verifyingContract: PERMIT2 },
    message: {
      permitted: { token: USDC_BASE, amount: '100000' },
      spender: '0x2222222222222222222222222222222222222222',
      nonce: '7',
      deadline: String(Math.floor(Date.now() / 1000) + 600),
    },
  };
  const permitMessage = JSON.stringify(permitTypedData);
  const permitOption: IWcPayOption = {
    id: 'opt-1',
    account: `eip155:8453:${SENDER}`,
    amount: {
      unit: 'usdc',
      value: '100000',
      display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
    },
    etaS: 10,
    actions: [],
  };
  const solOption: IWcPayOption = {
    id: 'opt-sol',
    account: `${SOL_CHAIN}:${SOL_PAYER}`,
    amount: {
      unit: 'usdc',
      value: '1500',
      display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
    },
    etaS: 10,
    actions: [],
  };

  const permitAction = buildAction({
    method: EWcPayActionMethod.EthSignTypedDataV4,
    params: [SENDER, permitMessage],
    chainId: 'eip155:8453',
  });
  // shaped to match `permitOption` exactly, so getWcPayInlineTxPlan admits it
  // (0x186a0 === 100000)
  const buildTransferAction = () =>
    buildAction({
      method: EWcPayActionMethod.EthSendTransaction,
      params: [{ from: SENDER, to: SENDER, value: '0x186a0' }],
      chainId: 'eip155:8453',
    });
  const solanaAction = buildAction({
    method: EWcPayActionMethod.SolanaSignTransaction,
    params: [{ transaction: SOL_TX_BASE64 }],
    chainId: SOL_CHAIN,
  });

  const services = jest.requireMock<{
    default: {
      serviceNetwork: { getGlobalDeriveTypeOfNetwork: jest.Mock };
      serviceAccount: { getNetworkAccount: jest.Mock };
      serviceToken: { fetchTokensDetails: jest.Mock };
      serviceWalletConnectPay: {
        waitForTxMined: jest.Mock;
        isTxNeverBroadcast: jest.Mock;
        checkSolanaTxMatchesOrder: jest.Mock;
      };
    };
  }>('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
  const { getNetworkAccount } = services.serviceAccount;
  const { fetchTokensDetails } = services.serviceToken;
  const { waitForTxMined, isTxNeverBroadcast, checkSolanaTxMatchesOrder } =
    services.serviceWalletConnectPay;
  const { wcPayInlineSendTx } = jest.requireMock<{
    wcPayInlineSendTx: jest.Mock;
  }>('../wcPayInlineSendTx');
  const { wcPayInlineSignTypedData } = jest.requireMock<{
    wcPayInlineSignTypedData: jest.Mock;
  }>('../wcPayInlineSignMessage');
  const { wcPayInlineSignSolanaTx } = jest.requireMock<{
    wcPayInlineSignSolanaTx: jest.Mock;
  }>('../wcPayInlineSignSolana');

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    pushModalMock.mockReset();
    // every confirm modal settles successfully, whichever kind it is; the tx
    // result carries both a txid (EVM) and a rawTx (Solana sign-only)
    pushModalMock.mockImplementation((_route, { params }) => {
      if (params.unsignedMessage) {
        params.onSuccess('0xsig-modal');
      } else {
        params.onSuccess([
          { signedTx: { txid: '0xtxid-confirm', rawTx: 'rawtx-confirm' } },
        ]);
      }
    });
    getNetworkAccount.mockReset();
    getNetworkAccount.mockResolvedValue({ id: 'account-1', address: SENDER });
    fetchTokensDetails.mockReset();
    fetchTokensDetails.mockResolvedValue([
      { info: { address: USDC_BASE, symbol: 'USDC', decimals: 6 } },
    ]);
    waitForTxMined.mockReset();
    waitForTxMined.mockResolvedValue({ isReverted: false });
    isTxNeverBroadcast.mockReset();
    isTxNeverBroadcast.mockResolvedValue(false);
    checkSolanaTxMatchesOrder.mockReset();
    checkSolanaTxMatchesOrder.mockResolvedValue({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'native',
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
    wcPayInlineSendTx.mockReset();
    wcPayInlineSendTx.mockResolvedValue({ status: 'ok', txid: '0xinline' });
    wcPayInlineSignTypedData.mockReset();
    wcPayInlineSignTypedData.mockResolvedValue({
      status: 'ok',
      signature: '0xpermit',
    });
    wcPayInlineSignSolanaTx.mockReset();
    wcPayInlineSignSolanaTx.mockResolvedValue({
      status: 'ok',
      rawTx: 'c2lnbmVk',
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('signs a matching Permit2 payload inline instead of pushing MessageConfirm', async () => {
    const controller = buildController();
    const onActionComplete = jest.fn();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [permitAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: controller,
      onActionComplete,
    });

    expect(signatures).toEqual(['0xpermit']);
    expect(pushModalMock).not.toHaveBeenCalled();
    expect(controller.onSigningSummary).toHaveBeenCalledWith({
      kind: 'typedData',
      summary: expect.objectContaining({ amountRaw: '100000' }),
    });
    expect(onActionComplete).toHaveBeenCalledWith({
      index: 0,
      result: '0xpermit',
    });
    expect(wcPayInlineSignTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'evm--8453',
        accountId: 'account-1',
        accountAddress: SENDER,
        // the payload is signed verbatim, never re-serialized
        message: permitMessage,
        option: permitOption,
        sourceInfo: expect.objectContaining({ scope: 'ethereum' }),
        // the executor's own checker, never the raw signal: the retirement
        // rule has to travel into the pipeline with it
        throwIfCancelled: expect.any(Function),
      }),
    );
  });

  it('leaves the signing phase as soon as an inline signature exists', async () => {
    // The sheet renders what is being signed only during `signingMessage`, so
    // the phase must move on the moment the signature is in hand — otherwise
    // the summary lingers on screen through a later action's confirm page or
    // Permit2's minutes-long mined-wait, describing a signature already given.
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    await result.current.executeActions({
      actions: [permitAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: controller,
    });

    expect(controller.onPhase).toHaveBeenLastCalledWith('recording');
    // The mocked pipeline emits no phases of its own, so this call can only
    // come from the executor — and it is made after `await`ing the pipeline,
    // which the ordering below pins down.
    expect(controller.onPhase.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      wcPayInlineSignTypedData.mock.invocationCallOrder[0],
    );
  });

  it('resolves the permit token through the wallet registry for this chain', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());
    await result.current.executeActions({
      actions: [permitAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
    });

    expect(fetchTokensDetails).toHaveBeenCalledWith({
      networkId: 'evm--8453',
      accountId: 'account-1',
      contractList: [USDC_BASE],
    });
  });

  // A plan-level refusal happens before inline execution starts, so it is not
  // a transition OUT of inline execution: the same treatment the
  // eth_sendTransaction branch gives its own plan fallbacks.
  it('pushes MessageConfirm without announcing a fallback when the token is unknown', async () => {
    fetchTokensDetails.mockResolvedValue([]);
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [permitAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: controller,
    });

    expect(signatures).toEqual(['0xsig-modal']);
    expect(wcPayInlineSignTypedData).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(controller.onBeforePushConfirmModal).toHaveBeenCalledTimes(1);
    expect(controller.onFallback).not.toHaveBeenCalled();
  });

  it('announces a fallback and uses the confirm page when the pipeline refuses', async () => {
    wcPayInlineSignTypedData.mockResolvedValue({
      status: 'fallback',
      reason: 'x',
    });
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [permitAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: controller,
    });

    expect(signatures).toEqual(['0xsig-modal']);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
    expect(pushModalMock).toHaveBeenCalledTimes(1);
  });

  // The backup dialog is an RN-layer dialog the sheet would cover: the flow
  // has to be told through onInlineFailure so it can close the sheet.
  it('routes a typed-data backup abort through the not-backed-up failure', async () => {
    wcPayInlineSignTypedData.mockResolvedValue({ status: 'abort' });
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    await expect(
      result.current.executeActions({
        actions: [permitAction],
        accountId: 'account-1',
        option: permitOption,
        inlineController: controller,
      }),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
    expect(controller.onInlineFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: EWcPayInlineFailureKind.WalletNotBackedUp,
      }),
    );
    expect(pushModalMock).not.toHaveBeenCalled();
  });

  // The sequence budget covers every inline-eligible shape, so a spent
  // transfer must push the follow-up permit to its confirm page.
  it('refuses to inline a permit after the sequence already inlined a transfer', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildTransferAction(), permitAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
    });

    expect(signatures).toEqual(['0xinline', '0xsig-modal']);
    expect(wcPayInlineSignTypedData).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_BUDGET_REASON,
    );
  });

  it('refuses to inline a transfer after the sequence already inlined a permit', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [permitAction, buildTransferAction()],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
    });

    expect(signatures).toEqual(['0xpermit', '0xtxid-confirm']);
    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_BUDGET_REASON,
    );
  });

  it('signs a matching Solana payment inline instead of pushing TxConfirm', async () => {
    getNetworkAccount.mockResolvedValue({
      id: 'account-1',
      address: SOL_PAYER,
    });
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [solanaAction],
      accountId: 'account-1',
      option: solOption,
      inlineController: controller,
    });

    expect(signatures).toEqual(['c2lnbmVk']);
    expect(pushModalMock).not.toHaveBeenCalled();
    expect(controller.onSigningSummary).toHaveBeenCalledWith({
      kind: 'solana',
      summary: expect.objectContaining({ amountRaw: '1500', kind: 'native' }),
    });
    expect(checkSolanaTxMatchesOrder).toHaveBeenCalledWith({
      txBase64: SOL_TX_BASE64,
      caip2ChainId: SOL_CHAIN,
      option: solOption,
    });
    expect(wcPayInlineSignSolanaTx).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'sol--101',
        accountId: 'account-1',
        accountAddress: SOL_PAYER,
        option: solOption,
        // signed exactly what the background checked
        txBase64: SOL_TX_BASE64,
        sourceInfo: expect.objectContaining({ scope: 'solana' }),
        // the executor's own checker, never the raw signal (see the
        // typed-data pipeline above)
        throwIfCancelled: expect.any(Function),
      }),
    );
  });

  it('resolves an spl mint through the wallet registry and falls back when it disagrees', async () => {
    getNetworkAccount.mockResolvedValue({
      id: 'account-1',
      address: SOL_PAYER,
    });
    checkSolanaTxMatchesOrder.mockResolvedValue({
      ok: true,
      summary: {
        amountRaw: '1500',
        kind: 'spl',
        mint: SOL_MINT,
        decimals: 6,
        priorityFeeLamports: '0',
        sponsoredFee: false,
        fundsRecipientAta: false,
      },
    });
    // the registry knows this mint under a different symbol than the order
    // displays, so the identity the option claims is unproven
    fetchTokensDetails.mockResolvedValue([
      { info: { address: SOL_MINT, symbol: 'NOTUSDC', decimals: 6 } },
    ]);
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [solanaAction],
      accountId: 'account-1',
      option: solOption,
      inlineController: buildController(),
    });

    expect(fetchTokensDetails).toHaveBeenCalledWith({
      networkId: 'sol--101',
      accountId: 'account-1',
      contractList: [SOL_MINT],
    });
    expect(wcPayInlineSignSolanaTx).not.toHaveBeenCalled();
    expect(signatures).toEqual(['rawtx-confirm']);
  });

  it('pushes TxConfirm when the background refuses the Solana blob', async () => {
    getNetworkAccount.mockResolvedValue({
      id: 'account-1',
      address: SOL_PAYER,
    });
    checkSolanaTxMatchesOrder.mockResolvedValue({
      ok: false,
      reason: 'unsupported instruction',
    });
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [solanaAction],
      accountId: 'account-1',
      option: solOption,
      inlineController: controller,
    });

    expect(signatures).toEqual(['rawtx-confirm']);
    expect(wcPayInlineSignSolanaTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(controller.onFallback).not.toHaveBeenCalled();
  });

  it('routes a Solana backup abort through the not-backed-up failure', async () => {
    getNetworkAccount.mockResolvedValue({
      id: 'account-1',
      address: SOL_PAYER,
    });
    wcPayInlineSignSolanaTx.mockResolvedValue({ status: 'abort' });
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    await expect(
      result.current.executeActions({
        actions: [solanaAction],
        accountId: 'account-1',
        option: solOption,
        inlineController: controller,
      }),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
    expect(controller.onInlineFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: EWcPayInlineFailureKind.WalletNotBackedUp,
      }),
    );
    expect(pushModalMock).not.toHaveBeenCalled();
  });

  it('announces a fallback and uses TxConfirm when the Solana pipeline refuses', async () => {
    getNetworkAccount.mockResolvedValue({
      id: 'account-1',
      address: SOL_PAYER,
    });
    wcPayInlineSignSolanaTx.mockResolvedValue({
      status: 'fallback',
      reason: 'x',
    });
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [solanaAction],
      accountId: 'account-1',
      option: solOption,
      inlineController: controller,
    });

    expect(signatures).toEqual(['rawtx-confirm']);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
    expect(pushModalMock).toHaveBeenCalledTimes(1);
  });

  // The send leg carries two arguments no other route supplies: the
  // executor's own cancel checker (a bare signal would re-arm cancellation
  // after a broadcast) and the durable pre-broadcast identity, which must be
  // built exactly as the confirm page's is — the record is what a resumed
  // attempt reads to know the transfer was already sent.
  it('threads the cancel checker and the pre-broadcast record into the inline send', async () => {
    const transferAction = buildTransferAction();
    const progressContext = {
      paymentId: 'pay-1',
      optionId: 'opt-1',
      accountKey: 'acct-1',
    };
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [transferAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
      progressContext,
    });

    expect(signatures).toEqual(['0xinline']);
    expect(wcPayInlineSendTx).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'evm--8453',
        accountId: 'account-1',
        option: permitOption,
        sourceInfo: expect.objectContaining({ scope: 'ethereum' }),
        throwIfCancelled: expect.any(Function),
        wcPayPreBroadcastRecord: {
          ...progressContext,
          action: transferAction,
          index: 0,
        },
      }),
    );
  });

  // The stopped-after-broadcast exit is a UI boundary, and a headless
  // signature is one too: it raises the password prompt on a page that is
  // already gone. The window is narrow — between the loop-top guard and the
  // branch itself — but it is exactly where the inter-action wait sits.
  it('stops with the collected prefix instead of signing inline once the page closed', async () => {
    const cancelController = new AbortController();
    getNetworkAccount
      .mockResolvedValueOnce({ id: 'account-1', address: SENDER })
      .mockImplementationOnce(() => {
        cancelController.abort();
        return Promise.resolve({ id: 'account-1', address: SENDER });
      });
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [
        // does not match the order, so it takes the confirm page and leaves
        // the inline spend budget untouched for the permit below
        buildAction({
          method: EWcPayActionMethod.EthSendTransaction,
          params: [{ from: SENDER, to: SENDER, value: '0x1' }],
          chainId: 'eip155:8453',
        }),
        permitAction,
      ],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
      cancelSignal: cancelController.signal,
    });

    expect(signatures).toEqual(['0xtxid-confirm']);
    expect(wcPayInlineSignTypedData).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
  });

  // Same rule for the Phase 1 send leg: an inline broadcast is a UI boundary
  // too (password/hardware prompt), and the page that would own its recovery
  // is already gone.
  it('stops with the collected prefix instead of sending inline once the page closed', async () => {
    const cancelController = new AbortController();
    getNetworkAccount
      .mockResolvedValueOnce({ id: 'account-1', address: SENDER })
      .mockImplementationOnce(() => {
        cancelController.abort();
        return Promise.resolve({ id: 'account-1', address: SENDER });
      });
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [
        // does not match the order, so it takes the confirm page and leaves
        // the inline spend budget untouched for the transfer below
        buildAction({
          method: EWcPayActionMethod.EthSendTransaction,
          params: [{ from: SENDER, to: SENDER, value: '0x1' }],
          chainId: 'eip155:8453',
        }),
        buildTransferAction(),
      ],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
      cancelSignal: cancelController.signal,
    });

    expect(signatures).toEqual(['0xtxid-confirm']);
    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
  });

  // Solana sibling of the two prefix tests above: the sign-only pipeline
  // raises the same password/hardware prompt, so it obeys the same guard.
  it('stops with the collected prefix instead of signing a Solana action once the page closed', async () => {
    const cancelController = new AbortController();
    getNetworkAccount
      .mockResolvedValueOnce({ id: 'account-1', address: SENDER })
      .mockImplementationOnce(() => {
        cancelController.abort();
        return Promise.resolve({ id: 'account-1', address: SOL_PAYER });
      });
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [
        // an EVM transfer can never match a Solana order, so it takes the
        // confirm page and leaves the inline spend budget untouched
        buildAction({
          method: EWcPayActionMethod.EthSendTransaction,
          params: [{ from: SENDER, to: SENDER, value: '0x1' }],
          chainId: 'eip155:8453',
        }),
        solanaAction,
      ],
      accountId: 'account-1',
      option: solOption,
      inlineController: buildController(),
      cancelSignal: cancelController.signal,
    });

    expect(signatures).toEqual(['0xtxid-confirm']);
    expect(wcPayInlineSignSolanaTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
  });

  // The inline attempt itself spans an unbounded stretch (network, prompts),
  // so each branch re-checks between the attempt and the confirm push: a
  // modal pushed onto a stack whose owner is gone is unrecoverable.
  it('does not push MessageConfirm when the page closes during a typed-data attempt', async () => {
    const cancelController = new AbortController();
    wcPayInlineSignTypedData.mockImplementation(() => {
      cancelController.abort();
      return Promise.resolve({ status: 'fallback', reason: 'x' });
    });
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    await expect(
      result.current.executeActions({
        actions: [permitAction],
        accountId: 'account-1',
        option: permitOption,
        inlineController: controller,
        cancelSignal: cancelController.signal,
      }),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
    expect(pushModalMock).not.toHaveBeenCalled();
  });

  it('does not push TxConfirm when the page closes during a Solana attempt', async () => {
    const cancelController = new AbortController();
    getNetworkAccount.mockResolvedValue({
      id: 'account-1',
      address: SOL_PAYER,
    });
    wcPayInlineSignSolanaTx.mockImplementation(() => {
      cancelController.abort();
      return Promise.resolve({ status: 'fallback', reason: 'x' });
    });
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    await expect(
      result.current.executeActions({
        actions: [solanaAction],
        accountId: 'account-1',
        option: solOption,
        inlineController: controller,
        cancelSignal: cancelController.signal,
      }),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
    expect(pushModalMock).not.toHaveBeenCalled();
  });

  it('does not push TxConfirm when the page closes during an inline send attempt', async () => {
    const cancelController = new AbortController();
    wcPayInlineSendTx.mockImplementation(() => {
      cancelController.abort();
      return Promise.resolve({
        status: 'fallback',
        failure: {
          kind: EWcPayInlineFailureKind.PreSignBlocked,
          message: 'x',
          retryable: false,
        },
      });
    });
    const controller = buildController();
    controller.onInlineFailure.mockResolvedValue('fallback');
    const { result } = renderHook(() => useWcPayActionExecutor());

    await expect(
      result.current.executeActions({
        actions: [buildTransferAction()],
        accountId: 'account-1',
        option: permitOption,
        inlineController: controller,
        cancelSignal: cancelController.signal,
      }),
    ).rejects.toBeInstanceOf(WcPayUserCancelledError);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
    expect(pushModalMock).not.toHaveBeenCalled();
  });

  // Boundaries only a run that ALREADY broadcast can reach: from that point
  // the cancel signal is retired (throwIfCancelled becomes a no-op), so each
  // of these UI steps is held by isStoppedAfterBroadcast alone. Every exit
  // returns a PROPER PREFIX, the caller's contract for "do not submit".
  describe('stopped-after-broadcast boundaries', () => {
    // deliberately unlike the order, so it takes the confirm page and leaves
    // the inline spend budget untouched for the action under test
    const buildUnmatchedTransferAction = () =>
      buildAction({
        method: EWcPayActionMethod.EthSendTransaction,
        params: [{ from: SENDER, to: SENDER, value: '0x1' }],
        chainId: 'eip155:8453',
      });

    it('does not start the next action when the page closed during the mined-wait', async () => {
      const cancelController = new AbortController();
      waitForTxMined.mockImplementation(() => {
        cancelController.abort();
        return Promise.resolve({ isReverted: false });
      });
      const { result } = renderHook(() => useWcPayActionExecutor());

      const signatures = await result.current.executeActions({
        actions: [buildTransferAction(), permitAction],
        accountId: 'account-1',
        option: permitOption,
        inlineController: buildController(),
        cancelSignal: cancelController.signal,
      });

      expect(signatures).toEqual(['0xinline']);
      // the loop-top guard is what stopped it: resolving the signing account
      // is the first thing the next iteration would do
      expect(getNetworkAccount).toHaveBeenCalledTimes(1);
      expect(pushModalMock).not.toHaveBeenCalled();
    });

    it('returns the prefix instead of waiting for the mine once the page closed', async () => {
      const cancelController = new AbortController();
      wcPayInlineSendTx.mockImplementation(() => {
        cancelController.abort();
        return Promise.resolve({ status: 'ok', txid: '0xinline' });
      });
      const { result } = renderHook(() => useWcPayActionExecutor());

      const signatures = await result.current.executeActions({
        actions: [buildTransferAction(), permitAction],
        accountId: 'account-1',
        option: permitOption,
        inlineController: buildController(),
        cancelSignal: cancelController.signal,
      });

      expect(signatures).toEqual(['0xinline']);
      // the mined-wait serves only the follow-up signing, which will never be
      // requested — blocking on it for minutes would buy nothing
      expect(waitForTxMined).not.toHaveBeenCalled();
      expect(pushModalMock).not.toHaveBeenCalled();
    });

    it('does not push TxConfirm after an inline send fell back once the page closed', async () => {
      const cancelController = new AbortController();
      wcPayInlineSendTx.mockImplementation(() => {
        cancelController.abort();
        return Promise.resolve({
          status: 'fallback',
          failure: {
            kind: EWcPayInlineFailureKind.PreSignBlocked,
            message: 'x',
            retryable: false,
          },
        });
      });
      const controller = buildController();
      controller.onInlineFailure.mockResolvedValue('fallback');
      const { result } = renderHook(() => useWcPayActionExecutor());

      const signatures = await result.current.executeActions({
        actions: [buildUnmatchedTransferAction(), buildTransferAction()],
        accountId: 'account-1',
        option: permitOption,
        inlineController: controller,
        cancelSignal: cancelController.signal,
      });

      expect(signatures).toEqual(['0xtxid-confirm']);
      expect(controller.onFallback).toHaveBeenCalledTimes(1);
      // the first action's confirm page only, never the fallen-back one's
      expect(pushModalMock).toHaveBeenCalledTimes(1);
    });

    it('does not push MessageConfirm after a typed-data attempt fell back once the page closed', async () => {
      const cancelController = new AbortController();
      wcPayInlineSignTypedData.mockImplementation(() => {
        cancelController.abort();
        return Promise.resolve({ status: 'fallback', reason: 'x' });
      });
      const controller = buildController();
      const { result } = renderHook(() => useWcPayActionExecutor());

      const signatures = await result.current.executeActions({
        actions: [buildUnmatchedTransferAction(), permitAction],
        accountId: 'account-1',
        option: permitOption,
        inlineController: controller,
        cancelSignal: cancelController.signal,
      });

      expect(signatures).toEqual(['0xtxid-confirm']);
      expect(controller.onFallback).toHaveBeenCalledTimes(1);
      expect(pushModalMock).toHaveBeenCalledTimes(1);
    });

    it('does not push TxConfirm after a Solana attempt fell back once the page closed', async () => {
      const cancelController = new AbortController();
      getNetworkAccount
        .mockResolvedValueOnce({ id: 'account-1', address: SENDER })
        .mockResolvedValue({ id: 'account-1', address: SOL_PAYER });
      wcPayInlineSignSolanaTx.mockImplementation(() => {
        cancelController.abort();
        return Promise.resolve({ status: 'fallback', reason: 'x' });
      });
      const controller = buildController();
      const { result } = renderHook(() => useWcPayActionExecutor());

      const signatures = await result.current.executeActions({
        actions: [buildUnmatchedTransferAction(), solanaAction],
        accountId: 'account-1',
        option: solOption,
        inlineController: controller,
        cancelSignal: cancelController.signal,
      });

      expect(signatures).toEqual(['0xtxid-confirm']);
      expect(controller.onFallback).toHaveBeenCalledTimes(1);
      expect(pushModalMock).toHaveBeenCalledTimes(1);
    });
  });

  it('refuses to inline a Solana action after the sequence already inlined a transfer', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildTransferAction(), solanaAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
    });

    expect(signatures).toEqual(['0xinline', 'rawtx-confirm']);
    expect(wcPayInlineSignSolanaTx).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_BUDGET_REASON,
    );
  });

  // The budget is spent at the ATTEMPT, not at its success: an attempt may
  // already have moved funds by the time it reports back, so a failed one
  // must not hand the sequence a second inline spend.
  it('counts a failed inline attempt against the sequence budget', async () => {
    wcPayInlineSignTypedData.mockResolvedValue({
      status: 'fallback',
      reason: 'x',
    });
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [permitAction, buildTransferAction()],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
    });

    expect(signatures).toEqual(['0xsig-modal', '0xtxid-confirm']);
    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_BUDGET_REASON,
    );
  });

  // A pipeline REJECTION is not a fallback suggestion: tagged, it means a
  // transaction may already be on chain; untagged, it failed before anything
  // was signed. Either way the page owns the recovery decision, so the very
  // error has to reach it — converting one into a confirm-page fallback would
  // re-present a payment that may already have been made.
  describe('pipeline rejections reach the caller untouched', () => {
    const buildTaggedError = () => {
      const error = new Error('post-sign boom');
      (error as unknown as Record<string, unknown>)[
        WC_PAY_INLINE_POST_SIGN_FLAG
      ] = true;
      return error;
    };

    const branches = [
      {
        label: 'eth_sendTransaction',
        pipeline: wcPayInlineSendTx,
        prepare: () => {
          getNetworkAccount.mockResolvedValue({
            id: 'account-1',
            address: SENDER,
          });
        },
        buildActions: () => [buildTransferAction()],
        caseOption: permitOption,
      },
      {
        label: 'eth_signTypedData_v4',
        pipeline: wcPayInlineSignTypedData,
        prepare: () => {
          getNetworkAccount.mockResolvedValue({
            id: 'account-1',
            address: SENDER,
          });
        },
        buildActions: () => [permitAction],
        caseOption: permitOption,
      },
      {
        label: 'solana_signTransaction',
        pipeline: wcPayInlineSignSolanaTx,
        prepare: () => {
          getNetworkAccount.mockResolvedValue({
            id: 'account-1',
            address: SOL_PAYER,
          });
        },
        buildActions: () => [solanaAction],
        caseOption: solOption,
      },
    ];
    const shapes = [
      { shape: 'a tagged post-sign error', buildError: buildTaggedError },
      { shape: 'a plain pre-sign error', buildError: () => new Error('boom') },
    ];
    const cases = branches.flatMap((branch) =>
      shapes.map((errorShape) => ({ ...branch, ...errorShape })),
    );

    it.each(cases)(
      'rethrows $shape from the $label pipeline',
      async ({ pipeline, prepare, buildActions, caseOption, buildError }) => {
        prepare();
        const error = buildError();
        pipeline.mockRejectedValue(error);
        const controller = buildController();
        const { result } = renderHook(() => useWcPayActionExecutor());

        await expect(
          result.current.executeActions({
            actions: buildActions(),
            accountId: 'account-1',
            option: caseOption,
            inlineController: controller,
          }),
          // the SAME object, not a copy: the post-sign tag and everything
          // else the recovery machinery reads must survive
        ).rejects.toBe(error);
        expect(pushModalMock).not.toHaveBeenCalled();
        expect(controller.onFallback).not.toHaveBeenCalled();
        expect(controller.onInlineFailure).not.toHaveBeenCalled();
      },
    );
  });

  // The permit's own deadline bound: the payload may not stay signable for
  // much longer than the order it pays. Asserted on the value handed to the
  // validator, because three of the four cases produce the same visible
  // outcome (an inlined signature) and would not tell the bounds apart.
  describe('permit deadline bound', () => {
    const { getWcPayInlineMessagePlan } = jest.requireMock<{
      getWcPayInlineMessagePlan: jest.Mock;
    }>('../wcPayInlineUtils');

    beforeEach(() => {
      getWcPayInlineMessagePlan.mockClear();
    });

    const readMaxDeadlineS = () =>
      (getWcPayInlineMessagePlan.mock.calls[0][0] as { maxDeadlineS?: number })
        .maxDeadlineS;

    const runPermit = async (expiryMs?: number) => {
      const { result } = renderHook(() => useWcPayActionExecutor());
      return result.current.executeActions({
        actions: [permitAction],
        accountId: 'account-1',
        option: permitOption,
        inlineController: buildController(),
        expiryMs,
      });
    };

    // Phase 3 §6: the fixed validator ceiling is the whole bound — the
    // order-remaining coupling is gone, so a short-lived order no longer
    // rejects the multi-week sigDeadlines Pay SDKs customarily issue.
    it('passes the fixed validator ceiling whatever the order expiry', async () => {
      await runPermit(Date.now() + 600 * 1000);

      expect(readMaxDeadlineS()).toBe(WC_PAY_PERMIT_MAX_DEADLINE_S);
    });

    it('passes the fixed validator ceiling when the payment has no deadline', async () => {
      await runPermit(undefined);

      expect(readMaxDeadlineS()).toBe(WC_PAY_PERMIT_MAX_DEADLINE_S);
    });
  });

  // The inline branches persist their result the way the modal path does:
  // AWAITED, so the durable record normally lands before the sequence moves
  // on. Pinned by holding the persist open and proving the next action's
  // confirm modal waits for it — a dropped `await` would push it on time.
  describe('inline persistence ordering', () => {
    const buildBlockedPersist = () => {
      const order: string[] = [];
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const onActionComplete = jest.fn(async () => {
        order.push('persist:start');
        await gate;
        order.push('persist:end');
      });
      return { order, release: () => release(), onActionComplete };
    };

    // longer than the executor's own between-action wait, so a persist that
    // is merely started (not awaited) would have let the next modal through
    const AFTER_MODAL_TRANSITION_MS = 500;

    it('persists an inline permit signature before the next action opens its modal', async () => {
      const { order, release, onActionComplete } = buildBlockedPersist();
      pushModalMock.mockImplementation((_route, { params }) => {
        order.push('pushModal');
        params.onSuccess([
          { signedTx: { txid: '0xtxid-confirm', rawTx: 'rawtx-confirm' } },
        ]);
      });
      const { result } = renderHook(() => useWcPayActionExecutor());

      const pending = result.current.executeActions({
        actions: [permitAction, buildTransferAction()],
        accountId: 'account-1',
        option: permitOption,
        inlineController: buildController(),
        onActionComplete,
      });
      await new Promise((resolve) => {
        setTimeout(resolve, AFTER_MODAL_TRANSITION_MS);
      });
      expect(pushModalMock).not.toHaveBeenCalled();

      release();
      await expect(pending).resolves.toEqual(['0xpermit', '0xtxid-confirm']);
      // the confirm-page action persists as well, after its own modal
      expect(order).toEqual([
        'persist:start',
        'persist:end',
        'pushModal',
        'persist:start',
        'persist:end',
      ]);
    });

    it('persists an inline Solana signature before the next action opens its modal', async () => {
      getNetworkAccount.mockResolvedValue({
        id: 'account-1',
        address: SOL_PAYER,
      });
      const { order, release, onActionComplete } = buildBlockedPersist();
      pushModalMock.mockImplementation((_route, { params }) => {
        order.push('pushModal');
        params.onSuccess([
          { signedTx: { txid: '0xtxid-confirm', rawTx: 'rawtx-confirm' } },
        ]);
      });
      const { result } = renderHook(() => useWcPayActionExecutor());

      const pending = result.current.executeActions({
        actions: [solanaAction, buildTransferAction()],
        accountId: 'account-1',
        option: solOption,
        inlineController: buildController(),
        onActionComplete,
      });
      await new Promise((resolve) => {
        setTimeout(resolve, AFTER_MODAL_TRANSITION_MS);
      });
      expect(pushModalMock).not.toHaveBeenCalled();

      release();
      await expect(pending).resolves.toEqual(['c2lnbmVk', '0xtxid-confirm']);
      // the confirm-page action persists as well, after its own modal
      expect(order).toEqual([
        'persist:start',
        'persist:end',
        'pushModal',
        'persist:start',
        'persist:end',
      ]);
    });
  });

  // Without a controller (or without the selected option) nothing may be
  // signed inline, whatever the payload proves.
  it('never signs inline without an inline controller', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [permitAction],
      accountId: 'account-1',
      option: permitOption,
    });

    expect(signatures).toEqual(['0xsig-modal']);
    expect(wcPayInlineSignTypedData).not.toHaveBeenCalled();
  });
});

describe('useWcPayActionExecutor approve leg and sequence cap', () => {
  const SENDER = '0x1111111111111111111111111111111111111111';
  const TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
  const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';
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
  const approveData = (amountHex: string) =>
    `0x095ea7b3${PERMIT2.slice(2).padStart(64, '0')}${amountHex.padStart(
      64,
      '0',
    )}`;
  const buildApproveAction = (amountHex = (1_000_000).toString(16)) =>
    buildAction({
      method: EWcPayActionMethod.EthSendTransaction,
      params: [
        { from: SENDER, to: TOKEN, value: '0x0', data: approveData(amountHex) },
      ],
      chainId: 'eip155:8453',
    });
  const buildTransferAction = () =>
    buildAction({
      method: EWcPayActionMethod.EthSendTransaction,
      params: [{ from: SENDER, to: SENDER, value: '0xf4240' }],
      chainId: 'eip155:8453',
    });

  const services = jest.requireMock<{
    default: {
      serviceToken: { fetchTokensDetails: jest.Mock };
      serviceWalletConnectPay: {
        waitForTxMined: jest.Mock;
        isTxNeverBroadcast: jest.Mock;
      };
    };
  }>('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
  const { wcPayInlineSendTx } = jest.requireMock<{
    wcPayInlineSendTx: jest.Mock;
  }>('../wcPayInlineSendTx');

  const mockResolvedApproveToken = () => {
    services.serviceToken.fetchTokensDetails.mockResolvedValue([
      { info: { address: TOKEN, symbol: 'USDC', decimals: 6 } },
    ]);
  };

  beforeEach(() => {
    pushModalMock.mockReset();
    pushModalMock.mockImplementation((_route, { params }) => {
      params.onSuccess([{ signedTx: { txid: '0xtxid-confirm' } }]);
    });
    wcPayInlineSendTx.mockReset();
    wcPayInlineSendTx.mockResolvedValue({ status: 'ok', txid: '0xinline' });
    services.serviceToken.fetchTokensDetails.mockReset();
    services.serviceToken.fetchTokensDetails.mockResolvedValue([]);
    services.serviceWalletConnectPay.waitForTxMined.mockReset();
    services.serviceWalletConnectPay.waitForTxMined.mockResolvedValue({
      isReverted: false,
    });
    services.serviceWalletConnectPay.isTxNeverBroadcast.mockReset();
    services.serviceWalletConnectPay.isTxNeverBroadcast.mockResolvedValue(
      false,
    );
  });

  it('inlines the approve leg without charging the spend budget', async () => {
    mockResolvedApproveToken();
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildApproveAction(), buildTransferAction()],
      accountId: 'account-1',
      option,
      inlineController: controller,
    });

    // both legs inline: the approve consumed no budget, so the transfer's
    // spend was still available
    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(2);
    expect(wcPayInlineSendTx.mock.calls[0][0]).toEqual(
      expect.objectContaining({ intent: 'approve' }),
    );
    expect(wcPayInlineSendTx.mock.calls[1][0]).toEqual(
      expect.objectContaining({ intent: 'transfer' }),
    );
    expect(pushModalMock).not.toHaveBeenCalled();
    expect(signatures).toEqual(['0xinline', '0xinline']);
    expect(controller.onSigningSummary).toHaveBeenCalledWith({
      kind: 'approve',
      summary: { symbol: 'USDC', unlimited: false },
    });
  });

  it('flags an unlimited allowance in the approve summary', async () => {
    mockResolvedApproveToken();
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    await result.current.executeActions({
      actions: [buildApproveAction('f'.repeat(64))],
      accountId: 'account-1',
      option,
      inlineController: controller,
    });

    expect(controller.onSigningSummary).toHaveBeenCalledWith({
      kind: 'approve',
      summary: { symbol: 'USDC', unlimited: true },
    });
  });

  it('falls back to the confirm page when the approve token cannot be proven', async () => {
    // default fetchTokensDetails mock resolves [] — unknown token
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildApproveAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xtxid-confirm']);
  });

  it('falls back when the resolved token disagrees with the order asset', async () => {
    services.serviceToken.fetchTokensDetails.mockResolvedValue([
      { info: { address: TOKEN, symbol: 'SCAM', decimals: 6 } },
    ]);
    const { result } = renderHook(() => useWcPayActionExecutor());

    await result.current.executeActions({
      actions: [buildApproveAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
  });

  it('does not count a completed approve against a resumed budget', async () => {
    mockResolvedApproveToken();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildApproveAction(), buildTransferAction()],
      accountId: 'account-1',
      // the approve was broadcast by an earlier run
      completedResults: ['0xapprove-prev'],
      option,
      inlineController: buildController(),
    });

    // the transfer still inlines: the recorded approve consumed no budget
    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(1);
    expect(wcPayInlineSendTx.mock.calls[0][0]).toEqual(
      expect.objectContaining({ intent: 'transfer' }),
    );
    expect(signatures).toEqual(['0xapprove-prev', '0xinline']);
  });

  it('clears the signing summary at the top of every action', async () => {
    mockResolvedApproveToken();
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    await result.current.executeActions({
      actions: [buildApproveAction(), buildTransferAction()],
      accountId: 'account-1',
      option,
      inlineController: controller,
    });

    // one clear per action, each BEFORE any summary of that action
    const clearCalls = controller.onSigningSummary.mock.calls
      .map((args: unknown[], index: number) => ({ args, index }))
      .filter(({ args }) => args[0] === undefined);
    expect(clearCalls).toHaveLength(2);
    const approveSummaryIndex =
      controller.onSigningSummary.mock.calls.findIndex(
        (args: unknown[]) =>
          (args[0] as { kind?: string } | undefined)?.kind === 'approve',
      );
    expect(clearCalls[0].index).toBeLessThan(approveSummaryIndex);
  });

  it('refuses a sequence longer than the action cap outright', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    await expect(
      result.current.executeActions({
        actions: Array.from({ length: 9 }, () => buildTransferAction()),
        accountId: 'account-1',
        option,
        inlineController: buildController(),
      }),
    ).rejects.toThrow('Too many payment actions');
    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).not.toHaveBeenCalled();
  });
});

describe('useWcPayActionExecutor personal_sign inline', () => {
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
  // "Pay order #123" as the hex personal_sign payload
  const MESSAGE_HEX = '0x506179206f726465722023313233';
  const personalSignAction = buildAction({
    method: EWcPayActionMethod.PersonalSign,
    params: [MESSAGE_HEX, SENDER],
    chainId: 'eip155:8453',
  });
  const buildTransferAction = () =>
    buildAction({
      method: EWcPayActionMethod.EthSendTransaction,
      params: [{ from: SENDER, to: SENDER, value: '0xf4240' }],
      chainId: 'eip155:8453',
    });

  const { wcPayInlineSignPersonalMessage } = jest.requireMock<{
    wcPayInlineSignPersonalMessage: jest.Mock;
  }>('../wcPayInlineSignPersonalMessage');
  const { wcPayInlineSendTx } = jest.requireMock<{
    wcPayInlineSendTx: jest.Mock;
  }>('../wcPayInlineSendTx');

  beforeEach(() => {
    pushModalMock.mockReset();
    pushModalMock.mockImplementation((_route, { params }) => {
      params.onSuccess('0xsig-personal-modal');
    });
    wcPayInlineSignPersonalMessage.mockReset();
    wcPayInlineSignPersonalMessage.mockResolvedValue({
      status: 'ok',
      signature: '0xsig-personal-inline',
    });
    wcPayInlineSendTx.mockReset();
    wcPayInlineSendTx.mockResolvedValue({ status: 'ok', txid: '0xinline' });
  });

  it('signs inline with the gate-normalized message and no confirm page', async () => {
    const controller = buildController();
    const onActionComplete = jest.fn();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [personalSignAction],
      accountId: 'account-1',
      option,
      inlineController: controller,
      onActionComplete,
    });

    expect(pushModalMock).not.toHaveBeenCalled();
    expect(wcPayInlineSignPersonalMessage).toHaveBeenCalledTimes(1);
    expect(wcPayInlineSignPersonalMessage.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        message: MESSAGE_HEX,
        accountId: 'account-1',
        networkId: 'evm--8453',
      }),
    );
    expect(controller.onSigningSummary).toHaveBeenCalledWith({
      kind: 'personalSign',
      summary: { text: 'Pay order #123' },
    });
    expect(onActionComplete).toHaveBeenCalledWith({
      index: 0,
      result: '0xsig-personal-inline',
    });
    expect(signatures).toEqual(['0xsig-personal-inline']);
  });

  it('routes an undisplayable message to the confirm page', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [
        buildAction({
          method: EWcPayActionMethod.PersonalSign,
          // invalid UTF-8 → the gate refuses, the page renders it as hex
          params: ['0xdeadbeef', SENDER],
          chainId: 'eip155:8453',
        }),
      ],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSignPersonalMessage).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xsig-personal-modal']);
  });

  it('falls back to the confirm page when the pipeline declines pre-sign', async () => {
    wcPayInlineSignPersonalMessage.mockResolvedValue({
      status: 'fallback',
      reason: 'failed to resolve the signing account',
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const controller = buildController();
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [personalSignAction],
      accountId: 'account-1',
      option,
      inlineController: controller,
    });

    expect(controller.onFallback).toHaveBeenCalledTimes(1);
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xsig-personal-modal']);
    errorSpy.mockRestore();
  });

  it('never charges the spend budget for a personal_sign', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [personalSignAction, buildTransferAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    // the transfer after the signature still inlines: the signature spent
    // nothing
    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(1);
    expect(pushModalMock).not.toHaveBeenCalled();
    expect(signatures).toEqual(['0xsig-personal-inline', '0xinline']);
  });

  // A message signature is outside the spend budget but bounded on its own
  // (WC_PAY_MAX_INLINE_PERSONAL_SIGNS_PER_SEQUENCE): without that, a hostile
  // sequence could sign out one arbitrary EIP-191 message per action slot,
  // each shown for the dwell only and never clicked.
  it('inlines only the first personal_sign of a sequence', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [personalSignAction, personalSignAction],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSignPersonalMessage).toHaveBeenCalledTimes(1);
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual([
      '0xsig-personal-inline',
      '0xsig-personal-modal',
    ]);
    expect(errorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_PERSONAL_SIGN_BUDGET_REASON,
    );
    errorSpy.mockRestore();
  });

  it("counts a resumed run's completed personal_sign against the budget", async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [personalSignAction, personalSignAction],
      accountId: 'account-1',
      // signed in an earlier run, possibly inline: nothing records how
      completedResults: ['0xsig-earlier'],
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSignPersonalMessage).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xsig-earlier', '0xsig-personal-modal']);
    expect(errorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_PERSONAL_SIGN_BUDGET_REASON,
    );
    errorSpy.mockRestore();
  });
});

describe('useWcPayActionExecutor approve budget', () => {
  const SENDER = '0x1111111111111111111111111111111111111111';
  const TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
  const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';
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
  const buildApproveAction = () =>
    buildAction({
      method: EWcPayActionMethod.EthSendTransaction,
      params: [
        {
          from: SENDER,
          to: TOKEN,
          value: '0x0',
          data: `0x095ea7b3${PERMIT2.slice(2).padStart(64, '0')}${(1_000_000)
            .toString(16)
            .padStart(64, '0')}`,
        },
      ],
      chainId: 'eip155:8453',
    });

  const services = jest.requireMock<{
    default: {
      serviceToken: { fetchTokensDetails: jest.Mock };
      serviceWalletConnectPay: { waitForTxMined: jest.Mock };
    };
  }>('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
  const { wcPayInlineSendTx } = jest.requireMock<{
    wcPayInlineSendTx: jest.Mock;
  }>('../wcPayInlineSendTx');

  beforeEach(() => {
    pushModalMock.mockReset();
    pushModalMock.mockImplementation((_route, { params }) => {
      params.onSuccess([{ signedTx: { txid: '0xtxid-confirm' } }]);
    });
    wcPayInlineSendTx.mockReset();
    wcPayInlineSendTx.mockResolvedValue({ status: 'ok', txid: '0xinline' });
    services.serviceToken.fetchTokensDetails.mockReset();
    services.serviceToken.fetchTokensDetails.mockResolvedValue([
      { info: { address: TOKEN, symbol: 'USDC', decimals: 6 } },
    ]);
    services.serviceWalletConnectPay.waitForTxMined.mockReset();
    services.serviceWalletConnectPay.waitForTxMined.mockResolvedValue({
      isReverted: false,
    });
  });

  it('inlines only the first approve of a sequence', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildApproveAction(), buildApproveAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(1);
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xinline', '0xtxid-confirm']);
    expect(errorSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      WC_PAY_INLINE_APPROVE_BUDGET_REASON,
    );
    errorSpy.mockRestore();
  });
});

describe('useWcPayActionExecutor transfer asset binding', () => {
  const SENDER = '0x1111111111111111111111111111111111111111';
  const TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
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
  // transfer(address,uint256) moving exactly the order amount
  const transferData = `0xa9059cbb${SENDER.slice(2).padStart(
    64,
    '0',
  )}${(1_000_000).toString(16).padStart(64, '0')}`;
  const buildErc20TransferAction = () =>
    buildAction({
      method: EWcPayActionMethod.EthSendTransaction,
      params: [{ from: SENDER, to: TOKEN, value: '0x0', data: transferData }],
      chainId: 'eip155:8453',
    });
  const buildNativeTransferAction = () =>
    buildAction({
      method: EWcPayActionMethod.EthSendTransaction,
      params: [{ from: SENDER, to: SENDER, value: '0xf4240' }],
      chainId: 'eip155:8453',
    });

  const services = jest.requireMock<{
    default: {
      serviceNetwork: { getNetwork: jest.Mock };
      serviceToken: { fetchTokensDetails: jest.Mock };
      serviceWalletConnectPay: {
        waitForTxMined: jest.Mock;
        isTxNeverBroadcast: jest.Mock;
      };
    };
  }>('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
  const { wcPayInlineSendTx } = jest.requireMock<{
    wcPayInlineSendTx: jest.Mock;
  }>('../wcPayInlineSendTx');

  beforeEach(() => {
    pushModalMock.mockReset();
    pushModalMock.mockImplementation((_route, { params }) => {
      params.onSuccess([{ signedTx: { txid: '0xtxid-confirm' } }]);
    });
    wcPayInlineSendTx.mockReset();
    wcPayInlineSendTx.mockResolvedValue({ status: 'ok', txid: '0xinline' });
    services.serviceToken.fetchTokensDetails.mockReset();
    services.serviceToken.fetchTokensDetails.mockResolvedValue([]);
    services.serviceNetwork.getNetwork.mockReset();
    services.serviceNetwork.getNetwork.mockResolvedValue({
      id: 'evm--8453',
      symbol: 'USDC',
      decimals: 6,
    });
    services.serviceWalletConnectPay.waitForTxMined.mockReset();
    services.serviceWalletConnectPay.waitForTxMined.mockResolvedValue({
      isReverted: false,
    });
    services.serviceWalletConnectPay.isTxNeverBroadcast.mockReset();
    services.serviceWalletConnectPay.isTxNeverBroadcast.mockResolvedValue(
      false,
    );
  });

  it('inlines an ERC20 transfer once the registry proves the token', async () => {
    services.serviceToken.fetchTokensDetails.mockResolvedValue([
      { info: { address: TOKEN, symbol: 'USDC', decimals: 6 } },
    ]);
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildErc20TransferAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(1);
    expect(wcPayInlineSendTx.mock.calls[0][0]).toEqual(
      expect.objectContaining({ intent: 'transfer' }),
    );
    expect(pushModalMock).not.toHaveBeenCalled();
    expect(signatures).toEqual(['0xinline']);
    expect(services.serviceToken.fetchTokensDetails).toHaveBeenCalledWith(
      expect.objectContaining({ contractList: [TOKEN] }),
    );
  });

  it('falls back when the transfer token cannot be proven', async () => {
    // default fetchTokensDetails mock resolves [] — unknown token
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildErc20TransferAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
    expect(signatures).toEqual(['0xtxid-confirm']);
  });

  it('falls back when the resolved transfer token disagrees with the order asset', async () => {
    services.serviceToken.fetchTokensDetails.mockResolvedValue([
      { info: { address: TOKEN, symbol: 'SCAM', decimals: 6 } },
    ]);
    const { result } = renderHook(() => useWcPayActionExecutor());

    await result.current.executeActions({
      actions: [buildErc20TransferAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
  });

  it('inlines a native transfer when the network native asset matches the display', async () => {
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildNativeTransferAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).toHaveBeenCalledTimes(1);
    expect(wcPayInlineSendTx.mock.calls[0][0]).toEqual(
      expect.objectContaining({ intent: 'transfer' }),
    );
    expect(signatures).toEqual(['0xinline']);
  });

  it('falls back when the display disagrees with the network native asset', async () => {
    // the display claims USDC/6 while the chain's native asset is ETH/18 —
    // exactly the substitution the gate exists to catch
    services.serviceNetwork.getNetwork.mockResolvedValue({
      id: 'evm--8453',
      symbol: 'ETH',
      decimals: 18,
    });
    const { result } = renderHook(() => useWcPayActionExecutor());

    await result.current.executeActions({
      actions: [buildNativeTransferAction()],
      accountId: 'account-1',
      option,
      inlineController: buildController(),
    });

    expect(wcPayInlineSendTx).not.toHaveBeenCalled();
    expect(pushModalMock).toHaveBeenCalledTimes(1);
  });
});
