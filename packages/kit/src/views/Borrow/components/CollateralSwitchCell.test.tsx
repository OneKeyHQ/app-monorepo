/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text, View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  const dialogShow = jest.fn();
  const toastWarning = jest.fn();
  (globalThis as Record<string, unknown>).__collateralCellComponentsMock = {
    dialogShow,
    toastWarning,
  };
  const DialogFooter = (_props: {
    onConfirm: () => Promise<void>;
    confirmButtonProps?: { disabled?: boolean; loading?: boolean };
  }) =>
    React.createElement(View, {
      testID: 'mock-collateral-dialog-footer',
    });
  return {
    __esModule: true,
    Dialog: { show: dialogShow, Footer: DialogFooter },
    SizableText: Text,
    Stack: View,
    Switch: (props: Record<string, unknown>) =>
      React.createElement(View, props),
    Toast: { warning: toastWarning },
    YStack: View,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowTransactionConfirmation: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult', () => {
  const showDeFiActionTxConfirmDialog = jest.fn();
  const getLastSignedTxid = jest.fn(
    (data?: Array<{ signedTx?: { txid?: string } }>) =>
      data?.[data.length - 1]?.signedTx?.txid,
  );
  (globalThis as Record<string, unknown>).__collateralCellFinalStatusMock = {
    getLastSignedTxid,
    showDeFiActionTxConfirmDialog,
  };
  return {
    __esModule: true,
    getLastSignedTxid,
    showDeFiActionTxConfirmDialog,
  };
});

jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => {
  const waitForTxFinalStatus = jest.fn();
  (globalThis as Record<string, unknown>).__collateralCellWaitStatusMock =
    waitForTxFinalStatus;
  return { __esModule: true, waitForTxFinalStatus };
});

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const usePromiseResult = jest.fn();
  (globalThis as Record<string, unknown>).__collateralCellPromiseResultMock =
    usePromiseResult;
  return {
    __esModule: true,
    usePromiseResult,
  };
});

jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: {
    getEarnProviderName: ({ providerName }: { providerName: string }) =>
      providerName,
    normalizeBorrowAddress: ({
      networkId,
      address,
    }: {
      networkId: string;
      address: string;
    }) => (networkId.startsWith('evm--') ? address.toLowerCase() : address),
  },
}));

jest.mock('../BorrowProvider', () => {
  const useBorrowContext = jest.fn();
  (globalThis as Record<string, unknown>).__collateralCellContextMock =
    useBorrowContext;
  return {
    __esModule: true,
    useBorrowContext,
  };
});

jest.mock('../hooks/useUniversalBorrowHooks', () => {
  const setCollateral = jest.fn();
  const useUniversalBorrowSetCollateral = jest.fn(() => setCollateral);
  (globalThis as Record<string, unknown>).__collateralCellSetCollateralMock = {
    setCollateral,
    useUniversalBorrowSetCollateral,
  };
  return {
    __esModule: true,
    useUniversalBorrowSetCollateral,
  };
});

jest.mock(
  './ManagePosition/modules/InfoDisplaySection/HealthFactorInfo',
  () => ({
    __esModule: true,
    HealthFactorInfo: () => null,
  }),
);

import type { ReactElement } from 'react';

import { act, render } from '@testing-library/react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type {
  IBorrowReserveItem,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { CollateralSwitchCell } from './CollateralSwitchCell';

type ISuppliedAsset = IBorrowReserveItem['supplied']['assets'][number];

const componentsMock = (globalThis as Record<string, unknown>)
  .__collateralCellComponentsMock as {
  dialogShow: jest.Mock;
  toastWarning: jest.Mock;
};
const finalStatusMocks = (globalThis as Record<string, unknown>)
  .__collateralCellFinalStatusMock as {
  getLastSignedTxid: jest.Mock;
  showDeFiActionTxConfirmDialog: jest.Mock;
};
const waitStatusMock = (globalThis as Record<string, unknown>)
  .__collateralCellWaitStatusMock as jest.Mock;
const contextMock = (globalThis as Record<string, unknown>)
  .__collateralCellContextMock as jest.Mock;
const promiseResultMock = (globalThis as Record<string, unknown>)
  .__collateralCellPromiseResultMock as jest.Mock;
const setCollateralMocks = (globalThis as Record<string, unknown>)
  .__collateralCellSetCollateralMock as {
  setCollateral: jest.Mock;
  useUniversalBorrowSetCollateral: jest.Mock;
};

const switchTestId = 'borrow-supplied-collateral-switch';
const pendingSetCollateralTx = {
  stakingInfo: { tags: ['borrow:aave:setCollateral'] },
};
const successData = [
  {
    signedTx: { txid: '0xset-collateral' },
    decodedTx: { txid: '0xset-collateral', status: 'Pending' },
  },
] as ISendTxOnSuccessData[];

type ITestDialogOptions = {
  onClose?: () => void;
  renderContent: ReactElement<{
    onConfirm: () => Promise<void>;
  }>;
};

function createSuppliedAsset(
  usageAsCollateral: boolean,
  reserveAddress = '0xreserve',
): ISuppliedAsset {
  return {
    reserveAddress,
    usageAsCollateral,
    canBeCollateral: true,
    token: { symbol: 'USDC' },
  } as unknown as ISuppliedAsset;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('CollateralSwitchCell settlement guard', () => {
  let refreshAllBorrowData: jest.Mock;
  let borrowContext: {
    market: {
      networkId: string;
      provider: string;
      marketAddress: string;
      logoURI: string;
    };
    earnAccount: {
      data: { accountId?: string; account: { id: string } };
    };
    pendingTxs: Array<{ stakingInfo: { tags: string[] } }>;
    refreshAllBorrowData: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    componentsMock.dialogShow.mockReset();
    componentsMock.toastWarning.mockReset();
    finalStatusMocks.getLastSignedTxid.mockClear();
    finalStatusMocks.showDeFiActionTxConfirmDialog.mockReset();
    waitStatusMock.mockReset();
    waitStatusMock.mockResolvedValue(undefined);
    contextMock.mockReset();
    promiseResultMock.mockReset();
    promiseResultMock.mockReturnValue({
      result: { canBeCollateral: true },
      isLoading: false,
    });
    setCollateralMocks.setCollateral.mockReset();
    setCollateralMocks.useUniversalBorrowSetCollateral.mockClear();

    refreshAllBorrowData = jest.fn(async () => undefined);
    borrowContext = {
      market: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        logoURI: 'https://example.com/aave.png',
      },
      earnAccount: { data: { account: { id: 'account-1' } } },
      pendingTxs: [],
      refreshAllBorrowData,
    };
    contextMock.mockImplementation(() => borrowContext);
    setCollateralMocks.setCollateral.mockResolvedValue(undefined);
    componentsMock.dialogShow.mockImplementation(
      (options: {
        onClose?: () => void;
        renderContent: { props: { onConfirm: () => Promise<void> } };
      }) => {
        const dialog = {
          close: jest.fn(async () => options.onClose?.()),
        };
        void Promise.resolve().then(() =>
          options.renderContent.props.onConfirm(),
        );
        return dialog;
      },
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const getSwitch = (view: ReturnType<typeof render>) =>
    view.UNSAFE_root.findByProps({ testID: switchTestId });

  async function submitToggle(view: ReturnType<typeof render>) {
    await act(async () => {
      const { onChange } = getSwitch(view).props as { onChange: () => void };
      onChange();
      await flushMicrotasks();
    });
    expect(setCollateralMocks.setCollateral).toHaveBeenCalledTimes(1);
  }

  function getSetCollateralCallbacks() {
    return setCollateralMocks.setCollateral.mock.calls[0][0] as {
      stakingInfo: IStakingInfo;
      onSuccess: (data: ISendTxOnSuccessData[]) => void;
      onFail: () => void;
      onCancel: () => void;
    };
  }

  it('uses the top-level account id and preserves eModeId=0 when enabling', async () => {
    borrowContext.earnAccount.data.accountId = 'top-level-account';
    const view = render(
      <CollateralSwitchCell item={createSuppliedAsset(false)} eModeId={0} />,
    );

    await submitToggle(view);

    expect(
      setCollateralMocks.useUniversalBorrowSetCollateral,
    ).toHaveBeenLastCalledWith({
      networkId: 'evm--1',
      accountId: 'top-level-account',
    });
    expect(setCollateralMocks.setCollateral).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        useAsCollateral: true,
        eModeId: 0,
      }),
    );
  });

  it('omits eModeId when disabling collateral', async () => {
    promiseResultMock.mockReturnValue({
      result: { liquidationRisk: false },
      isLoading: false,
    });
    const view = render(
      <CollateralSwitchCell item={createSuppliedAsset(true)} eModeId={1} />,
    );

    await submitToggle(view);

    const request = setCollateralMocks.setCollateral.mock.calls[0][0] as {
      useAsCollateral: boolean;
      eModeId?: number;
    };
    expect(request.useAsCollateral).toBe(false);
    expect(request).not.toHaveProperty('eModeId');
  });

  it.each([
    [
      'the live preview rejects collateral eligibility',
      { canBeCollateral: false },
      false,
      true,
    ],
    ['the live preview is unavailable', undefined, false, true],
    ['the live preview is loading', { canBeCollateral: true }, true, false],
    [
      'the live preview reports liquidation risk',
      { canBeCollateral: true, liquidationRisk: true },
      false,
      false,
    ],
  ])(
    'blocks confirmation when %s',
    async (_title, confirmation, isLoading, showsUnavailable) => {
      promiseResultMock.mockReturnValue({
        result: confirmation,
        isLoading,
      });
      let dialogOptions: ITestDialogOptions | undefined;
      const close = jest.fn(async () => dialogOptions?.onClose?.());
      componentsMock.dialogShow.mockImplementation(
        (options: ITestDialogOptions) => {
          dialogOptions = options;
          return { close };
        },
      );
      const view = render(
        <CollateralSwitchCell item={createSuppliedAsset(false)} eModeId={1} />,
      );

      await act(async () => {
        const { onChange } = getSwitch(view).props as { onChange: () => void };
        onChange();
        await flushMicrotasks();
      });

      expect(dialogOptions).toBeDefined();
      const contentView = render(dialogOptions?.renderContent as ReactElement);
      const unavailableMessages = contentView.UNSAFE_root.findAll(
        (node) => node.props.children === 'defi_action_unavailable__msg',
      );
      expect(unavailableMessages.length > 0).toBe(showsUnavailable);
      const [footer] = contentView.UNSAFE_root.findAll(
        (node) =>
          node.props.confirmButtonProps?.disabled === true &&
          typeof node.props.onConfirm === 'function',
      );
      expect(footer).toBeDefined();
      const onConfirm = footer?.props.onConfirm as
        | (() => Promise<void>)
        | undefined;
      expect(onConfirm).toEqual(expect.any(Function));

      await act(async () => {
        await onConfirm?.();
        await flushMicrotasks();
      });
      expect(close).not.toHaveBeenCalled();
      expect(setCollateralMocks.setCollateral).not.toHaveBeenCalled();

      await act(async () => {
        dialogOptions?.onClose?.();
        await flushMicrotasks();
      });
    },
  );

  it('does not build after an account and market scope ABA transition', async () => {
    let dialogOptions: ITestDialogOptions | undefined;
    const close = jest.fn(async () => dialogOptions?.onClose?.());
    componentsMock.dialogShow.mockImplementation(
      (options: ITestDialogOptions) => {
        dialogOptions = options;
        return { close };
      },
    );
    const item = createSuppliedAsset(false);
    const initialMarket = borrowContext.market;
    const initialEarnAccount = borrowContext.earnAccount;
    const view = render(<CollateralSwitchCell item={item} eModeId={1} />);

    await act(async () => {
      const { onChange } = getSwitch(view).props as { onChange: () => void };
      onChange();
      await flushMicrotasks();
    });

    borrowContext.market = {
      ...borrowContext.market,
      networkId: 'evm--137',
      marketAddress: '0xnext-market',
    };
    borrowContext.earnAccount = {
      data: {
        accountId: 'account-2',
        account: { id: 'account-2-fallback' },
      },
    };
    view.rerender(<CollateralSwitchCell item={item} eModeId={2} />);
    await act(flushMicrotasks);

    borrowContext.market = initialMarket;
    borrowContext.earnAccount = initialEarnAccount;
    view.rerender(<CollateralSwitchCell item={item} eModeId={1} />);
    await act(flushMicrotasks);

    await act(async () => {
      const { onChange } = getSwitch(view).props as { onChange: () => void };
      onChange();
      await flushMicrotasks();
    });
    expect(componentsMock.dialogShow).toHaveBeenCalledTimes(1);

    await act(async () => {
      await dialogOptions?.renderContent.props.onConfirm();
      await flushMicrotasks();
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(setCollateralMocks.setCollateral).not.toHaveBeenCalled();
  });

  it('does not build after an eMode scope ABA transition', async () => {
    let dialogOptions: ITestDialogOptions | undefined;
    const close = jest.fn(async () => dialogOptions?.onClose?.());
    componentsMock.dialogShow.mockImplementation(
      (options: ITestDialogOptions) => {
        dialogOptions = options;
        return { close };
      },
    );
    const item = createSuppliedAsset(false);
    const view = render(<CollateralSwitchCell item={item} eModeId={1} />);

    await act(async () => {
      const { onChange } = getSwitch(view).props as { onChange: () => void };
      onChange();
      await flushMicrotasks();
    });

    view.rerender(<CollateralSwitchCell item={item} eModeId={undefined} />);
    await act(flushMicrotasks);
    view.rerender(<CollateralSwitchCell item={item} eModeId={1} />);
    await act(flushMicrotasks);

    await act(async () => {
      await dialogOptions?.renderContent.props.onConfirm();
      await flushMicrotasks();
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(setCollateralMocks.setCollateral).not.toHaveBeenCalled();
  });

  it('retains an active submission while eMode status revalidates', async () => {
    const item = createSuppliedAsset(false);
    const view = render(<CollateralSwitchCell item={item} eModeId={1} />);

    await submitToggle(view);
    expect(getSwitch(view).props.disabled).toBe(true);

    view.rerender(<CollateralSwitchCell item={item} eModeId={undefined} />);
    await act(flushMicrotasks);
    view.rerender(<CollateralSwitchCell item={item} eModeId={1} />);
    await act(flushMicrotasks);

    expect(getSwitch(view).props.disabled).toBe(true);
    act(() => {
      getSetCollateralCallbacks().onFail();
    });
    expect(getSwitch(view).props.disabled).toBe(false);
  });

  it('keeps the active submission across EVM address casing changes', async () => {
    borrowContext.market = {
      ...borrowContext.market,
      marketAddress: '0xAbCd',
    };
    const initialItem = createSuppliedAsset(false, '0xDeF0');
    const view = render(
      <CollateralSwitchCell item={initialItem} eModeId={1} />,
    );

    await submitToggle(view);
    expect(getSwitch(view).props.disabled).toBe(true);

    borrowContext.market = {
      ...borrowContext.market,
      marketAddress: '0xabcd',
    };
    view.rerender(
      <CollateralSwitchCell
        item={createSuppliedAsset(false, '0xdef0')}
        eModeId={1}
      />,
    );
    await act(flushMicrotasks);

    expect(getSwitch(view).props.disabled).toBe(true);
    act(() => {
      getSetCollateralCallbacks().onFail();
    });
    expect(getSwitch(view).props.disabled).toBe(false);
  });

  it('settles a failed dialog close and allows the switch to retry', async () => {
    componentsMock.dialogShow.mockImplementation(
      (options: ITestDialogOptions) => {
        void Promise.resolve().then(() =>
          options.renderContent.props.onConfirm(),
        );
        return {
          close: jest.fn(async () => {
            throw new OneKeyLocalError('dialog close failed');
          }),
        };
      },
    );
    const view = render(
      <CollateralSwitchCell item={createSuppliedAsset(false)} eModeId={1} />,
    );

    await act(async () => {
      const { onChange } = getSwitch(view).props as { onChange: () => void };
      onChange();
      await flushMicrotasks();
    });
    expect(setCollateralMocks.setCollateral).not.toHaveBeenCalled();

    await act(async () => {
      const { onChange } = getSwitch(view).props as { onChange: () => void };
      onChange();
      await flushMicrotasks();
    });
    expect(componentsMock.dialogShow).toHaveBeenCalledTimes(2);
    expect(setCollateralMocks.setCollateral).not.toHaveBeenCalled();
  });

  it('releases the local guard only when the final transaction failed', async () => {
    finalStatusMocks.showDeFiActionTxConfirmDialog.mockResolvedValue(
      EOnChainHistoryTxStatus.Failed,
    );
    const view = render(
      <CollateralSwitchCell item={createSuppliedAsset(false)} eModeId={1} />,
    );

    await submitToggle(view);
    expect(getSwitch(view).props.disabled).toBe(true);

    await act(async () => {
      getSetCollateralCallbacks().onSuccess(successData);
      await flushMicrotasks();
    });

    expect(finalStatusMocks.showDeFiActionTxConfirmDialog).toHaveBeenCalledWith(
      {
        accountId: 'account-1',
        networkId: 'evm--1',
        data: successData,
      },
    );
    expect(getSwitch(view).props.disabled).toBe(false);
    expect(refreshAllBorrowData).not.toHaveBeenCalled();
  });

  it('bounds stale-data refreshes and keeps the confirmed target optimistic', async () => {
    finalStatusMocks.showDeFiActionTxConfirmDialog.mockResolvedValue(
      EOnChainHistoryTxStatus.Success,
    );
    const staleItem = createSuppliedAsset(false);
    const view = render(<CollateralSwitchCell item={staleItem} eModeId={1} />);

    await submitToggle(view);
    await act(async () => {
      getSetCollateralCallbacks().onSuccess(successData);
      await flushMicrotasks();
    });
    expect(refreshAllBorrowData).toHaveBeenCalledTimes(1);

    borrowContext.pendingTxs = [pendingSetCollateralTx];
    view.rerender(<CollateralSwitchCell item={staleItem} eModeId={1} />);
    borrowContext.pendingTxs = [];
    view.rerender(<CollateralSwitchCell item={staleItem} eModeId={1} />);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await act(async () => {
        jest.advanceTimersByTime(3000);
        await flushMicrotasks();
      });
    }

    expect(refreshAllBorrowData).toHaveBeenCalledTimes(6);
    expect(componentsMock.toastWarning).toHaveBeenCalledTimes(1);
    expect(getSwitch(view).props.disabled).toBe(true);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        jest.advanceTimersByTime(15_000);
        await flushMicrotasks();
      });
    }

    expect(refreshAllBorrowData).toHaveBeenCalledTimes(9);
    expect(componentsMock.toastWarning).toHaveBeenCalledTimes(1);
    expect(getSwitch(view).props.value).toBe(true);
    expect(getSwitch(view).props.disabled).toBe(false);
    const refreshCountAfterSettlement = refreshAllBorrowData.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await flushMicrotasks();
    });
    expect(refreshAllBorrowData).toHaveBeenCalledTimes(
      refreshCountAfterSettlement,
    );
  });

  it('rechecks an unknown dialog result by txid, then releases local polling', async () => {
    finalStatusMocks.showDeFiActionTxConfirmDialog.mockResolvedValue(undefined);
    const view = render(
      <CollateralSwitchCell item={createSuppliedAsset(false)} eModeId={1} />,
    );

    await submitToggle(view);
    await act(async () => {
      getSetCollateralCallbacks().onSuccess(successData);
      await flushMicrotasks();
    });

    expect(componentsMock.toastWarning).toHaveBeenCalledTimes(1);
    expect(waitStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        networkId: 'evm--1',
        txid: '0xset-collateral',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(refreshAllBorrowData).toHaveBeenCalledTimes(1);
    expect(getSwitch(view).props.disabled).toBe(false);
  });

  it('ignores a late final-status callback after reserves already settled', async () => {
    const finalStatus = createDeferred<undefined>();
    finalStatusMocks.showDeFiActionTxConfirmDialog.mockReturnValue(
      finalStatus.promise,
    );
    const view = render(
      <CollateralSwitchCell item={createSuppliedAsset(false)} eModeId={1} />,
    );

    await submitToggle(view);
    act(() => {
      getSetCollateralCallbacks().onSuccess(successData);
    });
    view.rerender(
      <CollateralSwitchCell item={createSuppliedAsset(true)} eModeId={1} />,
    );
    await act(flushMicrotasks);

    await act(async () => {
      finalStatus.resolve(undefined);
      await flushMicrotasks();
    });

    expect(getSwitch(view).props.value).toBe(true);
    expect(getSwitch(view).props.disabled).toBe(false);
    expect(componentsMock.toastWarning).not.toHaveBeenCalled();
    expect(refreshAllBorrowData).not.toHaveBeenCalled();
    expect(waitStatusMock).not.toHaveBeenCalled();
  });

  it('falls back to exact-tx settlement when the result dialog rejects', async () => {
    finalStatusMocks.showDeFiActionTxConfirmDialog.mockRejectedValue(
      new Error('result dialog failed'),
    );
    waitStatusMock.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    const view = render(
      <CollateralSwitchCell item={createSuppliedAsset(false)} eModeId={1} />,
    );

    await submitToggle(view);
    expect(getSwitch(view).props.disabled).toBe(true);

    await act(async () => {
      getSetCollateralCallbacks().onSuccess(successData);
      await flushMicrotasks();
    });

    expect(waitStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        networkId: 'evm--1',
        txid: '0xset-collateral',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(refreshAllBorrowData).toHaveBeenCalledTimes(1);
    expect(componentsMock.toastWarning).not.toHaveBeenCalled();
    expect(getSwitch(view).props.value).toBe(true);
    expect(getSwitch(view).props.disabled).toBe(true);
  });
});
