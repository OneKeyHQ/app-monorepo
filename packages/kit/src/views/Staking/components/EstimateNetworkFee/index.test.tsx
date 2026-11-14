/** @jest-environment jsdom */

import { useShowStakeEstimateGasAlert, waitForStakeEstimateGasAlert } from './';

import { renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockDialogShow = jest.fn<unknown, unknown[]>();
const mockShowError = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (...args: unknown[]) => mockDialogShow(...args) },
  Icon: () => null,
  NumberSizeableText: () => null,
  SizableText: () => null,
  XStack: () => null,
  YStack: () => null,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    showToastOfError: (...args: unknown[]) => {
      mockShowError(...args);
    },
  },
}));
jest.mock('../CalculationList', () => ({ CalculationListItem: () => null }));

type IAlert = ReturnType<typeof useShowStakeEstimateGasAlert>;
type IAlertParams = Parameters<IAlert>[0];

function createAlert() {
  let params: IAlertParams | undefined;
  const instance = {
    close: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    getForm: () => undefined,
    isExist: () => true,
  };
  const showAlert: IAlert = (value) => {
    params = value;
    return instance;
  };
  const getParams = () => {
    if (!params) throw new OneKeyLocalError('Alert was not shown');
    return params;
  };
  return { showAlert, instance, getParams };
}

describe('stake network fee warning', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the optional close callback to the dialog', () => {
    const { result } = renderHook(() => useShowStakeEstimateGasAlert());
    const onClose = jest.fn();
    result.current({ estFiatValue: '1', onClose });
    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({ onClose }),
    );
  });

  it('accepts confirmation even when closing invokes onClose synchronously', async () => {
    const alert = createAlert();
    alert.instance.close.mockImplementation(async () => {
      alert.getParams().onClose?.();
    });
    const decision = waitForStakeEstimateGasAlert({
      showAlert: alert.showAlert,
      estFiatValue: '1',
      daysConsumed: '6 days',
    });
    const params = alert.getParams();
    expect(params).toMatchObject({ estFiatValue: '1', daysConsumed: '6 days' });
    await params.onConfirm?.({ ...alert.instance, preventClose: () => {} });
    await expect(decision).resolves.toBe(true);
    expect(alert.instance.close).toHaveBeenCalledTimes(1);
  });

  it.each(['onCancel', 'onClose'] as const)(
    'resolves false on %s',
    async (event) => {
      const alert = createAlert();
      const decision = waitForStakeEstimateGasAlert({
        showAlert: alert.showAlert,
        estFiatValue: '1',
      });
      alert.getParams()[event]?.();
      await expect(decision).resolves.toBe(false);
    },
  );

  it('does not show a warning for an already aborted task', async () => {
    const controller = new AbortController();
    controller.abort();
    const alert = createAlert();
    const showAlert = jest.fn(alert.showAlert);
    await expect(
      waitForStakeEstimateGasAlert({
        showAlert,
        estFiatValue: '1',
        signal: controller.signal,
      }),
    ).resolves.toBe(false);
    expect(showAlert).not.toHaveBeenCalled();
  });

  it('resolves false and closes the warning when the task aborts', async () => {
    const controller = new AbortController();
    const alert = createAlert();
    const decision = waitForStakeEstimateGasAlert({
      showAlert: alert.showAlert,
      estFiatValue: '1',
      signal: controller.signal,
    });
    controller.abort();
    await expect(decision).resolves.toBe(false);
    await Promise.resolve();
    expect(alert.instance.close).toHaveBeenCalledTimes(1);
    await alert.getParams().onConfirm?.({
      ...alert.instance,
      preventClose: () => {},
    });
    expect(alert.instance.close).toHaveBeenCalledTimes(1);
  });

  it('closes a warning when the task aborts during dialog creation', async () => {
    const controller = new AbortController();
    const alert = createAlert();
    const showAlert: IAlert = (params) => {
      const instance = alert.showAlert(params);
      controller.abort();
      return instance;
    };
    const decision = waitForStakeEstimateGasAlert({
      showAlert,
      estFiatValue: '1',
      signal: controller.signal,
    });
    await expect(decision).resolves.toBe(false);
    await Promise.resolve();
    expect(alert.instance.close).toHaveBeenCalledTimes(1);
  });

  it('returns false if the task aborts while a confirmed dialog is closing', async () => {
    const controller = new AbortController();
    const alert = createAlert();
    let finishClose = () => {};
    alert.instance.close.mockReturnValue(
      new Promise((resolve) => {
        finishClose = resolve;
      }),
    );
    const decision = waitForStakeEstimateGasAlert({
      showAlert: alert.showAlert,
      estFiatValue: '1',
      signal: controller.signal,
    });
    const confirmation = alert.getParams().onConfirm?.({
      ...alert.instance,
      preventClose: () => {},
    });
    controller.abort();
    await expect(decision).resolves.toBe(false);
    finishClose();
    await confirmation;
    expect(alert.instance.close).toHaveBeenCalledTimes(1);
  });
});
