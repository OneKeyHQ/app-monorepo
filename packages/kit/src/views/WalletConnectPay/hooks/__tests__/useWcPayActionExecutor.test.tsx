/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react-native';

import { EWcPayActionMethod } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IWcPayAction } from '@onekeyhq/shared/src/walletConnect/payTypes';

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
    serviceWalletConnectPay: {},
  };
  return { __esModule: true, default: services };
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
