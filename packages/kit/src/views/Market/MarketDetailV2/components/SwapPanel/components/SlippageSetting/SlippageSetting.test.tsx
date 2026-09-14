/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { SlippageSetting } from './SlippageSetting';

type IMockSettings = {
  swapSlippagePercentageMode: ESwapSlippageSegmentKey;
  swapSlippagePercentageCustomValue: number;
};

let mockSettings: IMockSettings;
const mockSetSettings = jest.fn(
  (updater: (value: IMockSettings) => IMockSettings) => {
    mockSettings = updater(mockSettings);
  },
);
const mockDialogShow = jest.fn();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => [mockSettings, mockSetSettings],
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (options: unknown) => {
      mockDialogShow(options);
    },
  },
  Icon: () => null,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) =>
    onPress ? (
      <button onClick={onPress} type="button">
        {children}
      </button>
    ) : (
      <div>{children}</div>
    ),
}));

jest.mock('@onekeyhq/kit/src/components/SlippageSettingDialog', () => ({
  __esModule: true,
  default: ({
    onSave,
  }: {
    onSave: (item: { key: ESwapSlippageSegmentKey; value: number }) => void;
  }) => (
    <button
      data-testid="save-custom-slippage"
      onClick={() =>
        onSave({
          key: ESwapSlippageSegmentKey.CUSTOM,
          value: 2,
        })
      }
      type="button"
    >
      save
    </button>
  ),
}));

jest.mock('../InfoItemLabel/InfoItemLabel', () => ({
  InfoItemLabel: () => <span>Slippage</span>,
}));

describe('SlippageSetting', () => {
  beforeEach(() => {
    mockSettings = {
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.AUTO,
      swapSlippagePercentageCustomValue: 0.5,
    };
    mockSetSettings.mockClear();
    mockDialogShow.mockClear();
  });

  it('reflects an external future-order slippage update', () => {
    const { rerender } = render(<SlippageSetting autoDefaultValue={0.5} />);

    expect(screen.getByText(/switch_auto \(0\.5%\)/)).toBeTruthy();

    mockSettings = {
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.CUSTOM,
      swapSlippagePercentageCustomValue: 2,
    };
    rerender(<SlippageSetting autoDefaultValue={0.5} />);

    expect(screen.getByText('2%')).toBeTruthy();
  });

  it('persists a direct Market slippage edit as custom', () => {
    const onSlippageChange = jest.fn();
    render(
      <SlippageSetting
        autoDefaultValue={0.5}
        onSlippageChange={onSlippageChange}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    const dialogOptions = mockDialogShow.mock.calls[0]?.[0] as {
      renderContent: ReactNode;
    };
    render(dialogOptions.renderContent);
    fireEvent.click(screen.getByTestId('save-custom-slippage'));

    expect(mockSettings).toEqual({
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.CUSTOM,
      swapSlippagePercentageCustomValue: 2,
    });
    expect(onSlippageChange).toHaveBeenCalledWith({
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 2,
    });
  });
});
