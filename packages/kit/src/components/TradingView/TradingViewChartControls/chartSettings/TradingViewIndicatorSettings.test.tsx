/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';

import { TradingViewIndicatorSettings } from './TradingViewIndicatorSettings';
import { createTradingViewIndicatorSettingsValue } from './TradingViewSettingsMockState';

import type { ITradingViewIndicatorSettingsValue } from './TradingViewSettingsMockState';

type IMockIndicatorSettingsDialogProps = {
  displayMode: 'focused' | 'full';
  maxActiveSubIndicatorCount: number | null;
  onConfirm?: () => boolean | Promise<boolean>;
  onReset: () => void;
  onToggleIndicator: (indicatorId: string, active: boolean) => void;
  selectedIndicatorId: string;
  selectedIndicatorScope: 'main' | 'sub';
  value: ITradingViewIndicatorSettingsValue;
};

const mockIndicatorSettingsDialog = jest.fn<null, [unknown]>(() => null);

function getIndicatorDialogProps() {
  return mockIndicatorSettingsDialog.mock.calls.at(
    -1,
  )?.[0] as IMockIndicatorSettingsDialogProps;
}

jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  Dialog: { show: jest.fn() },
}));

jest.mock('./TradingViewIndicatorContent', () => ({
  TradingViewIndicatorSettingsDialog: (props: unknown) =>
    mockIndicatorSettingsDialog(props),
}));

function createSettingsWithFiveActiveSubIndicators() {
  const value = createTradingViewIndicatorSettingsValue();
  let activeSubIndicatorCount = 0;
  value.indicators.forEach((indicator) => {
    if (indicator.scope === 'sub') {
      indicator.active = activeSubIndicatorCount < 5;
      if (indicator.active) {
        activeSubIndicatorCount += 1;
      }
    }
  });
  expect(activeSubIndicatorCount).toBe(5);
  return value;
}

function getActiveSubIndicatorCount(value: ITradingViewIndicatorSettingsValue) {
  return value.indicators.filter(
    (indicator) => indicator.scope === 'sub' && indicator.active,
  ).length;
}

describe('TradingViewIndicatorSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the shared editor default of four active sub-indicators', () => {
    render(
      <TradingViewIndicatorSettings
        value={createSettingsWithFiveActiveSubIndicators()}
      />,
    );

    const props = mockIndicatorSettingsDialog.mock.calls.at(-1)?.[0] as
      | IMockIndicatorSettingsDialogProps
      | undefined;
    expect(props?.maxActiveSubIndicatorCount).toBe(4);
    expect(props && getActiveSubIndicatorCount(props.value)).toBe(4);
  });

  it('preserves all active sub-indicators when the owner is uncapped', async () => {
    const onConfirm = jest.fn();
    render(
      <TradingViewIndicatorSettings
        value={createSettingsWithFiveActiveSubIndicators()}
        maxActiveSubIndicatorCount={null}
        onConfirm={onConfirm}
      />,
    );

    const props = mockIndicatorSettingsDialog.mock.calls.at(-1)?.[0] as
      | IMockIndicatorSettingsDialogProps
      | undefined;
    expect(props?.maxActiveSubIndicatorCount).toBeNull();
    expect(props && getActiveSubIndicatorCount(props.value)).toBe(5);
    await act(async () => {
      await props?.onConfirm?.();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(getActiveSubIndicatorCount(onConfirm.mock.calls[0][0])).toBe(5);
  });

  it('keeps the dialog open when saving fails and allows retrying', async () => {
    const error = new Error('Save failed');
    const onConfirm = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const onConfirmSuccess = jest.fn();
    const onConfirmError = jest.fn();
    render(
      <TradingViewIndicatorSettings
        onConfirm={onConfirm}
        onConfirmSuccess={onConfirmSuccess}
        onConfirmError={onConfirmError}
      />,
    );

    const getProps = () =>
      mockIndicatorSettingsDialog.mock.calls.at(
        -1,
      )?.[0] as IMockIndicatorSettingsDialogProps;
    await act(async () => {
      expect(await getProps().onConfirm?.()).toBe(false);
    });
    expect(onConfirmSuccess).not.toHaveBeenCalled();
    expect(onConfirmError).toHaveBeenCalledWith(error);

    await act(async () => {
      expect(await getProps().onConfirm?.()).toBe(true);
    });
    expect(onConfirmSuccess).toHaveBeenCalledTimes(1);
  });

  it('opens on the requested indicator', () => {
    const value = createTradingViewIndicatorSettingsValue();
    const target = value.indicators.find(
      (indicator) => indicator.scope === 'sub',
    );
    expect(target).toBeDefined();
    if (!target) {
      return;
    }

    render(
      <TradingViewIndicatorSettings
        displayMode="focused"
        initialIndicatorId={target.id}
        value={value}
      />,
    );

    const props = mockIndicatorSettingsDialog.mock.calls.at(-1)?.[0] as
      | IMockIndicatorSettingsDialogProps
      | undefined;
    expect(props).toEqual(
      expect.objectContaining({
        displayMode: 'focused',
        selectedIndicatorId: target.id,
        selectedIndicatorScope: 'sub',
      }),
    );
  });

  it('persists full reset defaults and closes after a successful retry', async () => {
    const defaults = createTradingViewIndicatorSettingsValue();
    const error = new Error('Reset save failed');
    const onConfirm = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const onConfirmSuccess = jest.fn();
    const onConfirmError = jest.fn();
    render(
      <TradingViewIndicatorSettings
        defaultValue={createSettingsWithFiveActiveSubIndicators()}
        onConfirm={onConfirm}
        onConfirmSuccess={onConfirmSuccess}
        onConfirmError={onConfirmError}
      />,
    );

    await act(async () => {
      getIndicatorDialogProps().onReset();
    });
    expect(onConfirm).toHaveBeenNthCalledWith(1, defaults);
    expect(onConfirmError).toHaveBeenCalledWith(error);
    expect(onConfirmSuccess).not.toHaveBeenCalled();

    await act(async () => {
      getIndicatorDialogProps().onReset();
    });
    expect(onConfirm).toHaveBeenNthCalledWith(2, defaults);
    expect(onConfirmSuccess).toHaveBeenCalledTimes(1);
  });

  it('keeps the full dialog open with edits made while reset persists', async () => {
    const defaults = createTradingViewIndicatorSettingsValue();
    const pending = createPromiseTarget<void>();
    const onConfirm = jest
      .fn()
      .mockReturnValueOnce(pending.ready)
      .mockResolvedValue(undefined);
    const onConfirmSuccess = jest.fn();
    render(
      <TradingViewIndicatorSettings
        onConfirm={onConfirm}
        onConfirmSuccess={onConfirmSuccess}
      />,
    );

    act(() => {
      getIndicatorDialogProps().onReset();
    });
    expect(onConfirm).toHaveBeenNthCalledWith(1, defaults);
    expect(onConfirmSuccess).not.toHaveBeenCalled();
    act(() => {
      getIndicatorDialogProps().onToggleIndicator('main-ma', false);
    });

    await act(async () => {
      pending.resolveTarget(undefined);
      await pending.ready;
    });
    expect(onConfirmSuccess).not.toHaveBeenCalled();
    const editedValue = getIndicatorDialogProps().value;
    expect(
      editedValue.indicators.find(({ id }) => id === 'main-ma')?.active,
    ).toBe(false);

    await act(async () => {
      await getIndicatorDialogProps().onConfirm?.();
    });
    expect(onConfirm).toHaveBeenNthCalledWith(2, editedValue);
    expect(onConfirmSuccess).toHaveBeenCalledTimes(1);
  });

  it('resets only the focused indicator and keeps it active', () => {
    const value = createTradingViewIndicatorSettingsValue();
    const target = value.indicators.find(
      (indicator) => indicator.scope === 'sub',
    );
    const preservedIndicator = value.indicators.find(
      (indicator) => indicator.id !== target?.id,
    );
    expect(target).toBeDefined();
    expect(preservedIndicator).toBeDefined();
    if (!target || !preservedIndicator) {
      return;
    }
    target.active = true;
    target.lines[0].color = '#123456';
    preservedIndicator.lines[0].color = '#654321';
    const expectedDefaultTarget =
      createTradingViewIndicatorSettingsValue().indicators.find(
        (indicator) => indicator.id === target.id,
      );
    expect(expectedDefaultTarget).toBeDefined();

    render(
      <TradingViewIndicatorSettings
        createDefaultValue={createTradingViewIndicatorSettingsValue}
        displayMode="focused"
        initialIndicatorId={target.id}
        value={value}
      />,
    );

    act(() => {
      const props = mockIndicatorSettingsDialog.mock.calls.at(-1)?.[0] as
        | IMockIndicatorSettingsDialogProps
        | undefined;
      props?.onReset();
    });

    const nextProps = mockIndicatorSettingsDialog.mock.calls.at(-1)?.[0] as
      | IMockIndicatorSettingsDialogProps
      | undefined;
    const resetTarget = nextProps?.value.indicators.find(
      (indicator) => indicator.id === target.id,
    );
    const preservedTarget = nextProps?.value.indicators.find(
      (indicator) => indicator.id === preservedIndicator.id,
    );
    expect(resetTarget).toEqual({
      ...expectedDefaultTarget,
      active: true,
    });
    expect(preservedTarget).toEqual(preservedIndicator);
  });
});
