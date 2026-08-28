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
import {
  EWcPayInlineFailureKind,
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
jest.mock('../wcPayInlineSignSolana', () => ({
  __esModule: true,
  wcPayInlineSignSolanaTx: jest.fn(),
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
      }),
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
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useWcPayActionExecutor());

    const signatures = await result.current.executeActions({
      actions: [buildTransferAction(), permitAction],
      accountId: 'account-1',
      option: permitOption,
      inlineController: buildController(),
    });

    expect(signatures).toEqual(['0xinline', '0xsig-modal']);
    expect(wcPayInlineSignTypedData).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      'inline spend budget exhausted',
    );
    warnSpy.mockRestore();
  });

  it('refuses to inline a transfer after the sequence already inlined a permit', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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
    expect(warnSpy).toHaveBeenCalledWith(
      'wcPay inline fallback',
      'inline spend budget exhausted',
    );
    warnSpy.mockRestore();
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
