/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { PercentageStageRow } from './PercentageStageRow';

const mockDismissKeyboard = jest.fn();

jest.mock('react-native', () => ({
  Keyboard: {
    dismiss: () => {
      mockDismissKeyboard();
    },
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  function Badge({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) {
    return (
      <button aria-label="percentage" onClick={onPress}>
        {children}
      </button>
    );
  }
  Badge.Text = ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    Badge,
    Button: ({ onPress, testID }: { onPress: () => void; testID: string }) => (
      <button
        aria-label="dismiss keyboard"
        data-testid={testID}
        onClick={onPress}
      />
    ),
    XStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

describe('PercentageStageRow', () => {
  beforeEach(() => mockDismissKeyboard.mockClear());

  it('selects the supplied percentages and dismisses the keyboard separately', () => {
    const onSelect = jest.fn();
    render(
      <PercentageStageRow
        stageList={[10, 35, 100]}
        onSelectPercentageStage={onSelect}
      />,
    );

    for (const stage of [10, 35, 100]) {
      fireEvent.click(screen.getByText(`${stage}%`));
    }
    expect(onSelect.mock.calls).toEqual([[10], [35], [100]]);
    expect(mockDismissKeyboard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('swap-stage-list-to-show-btn'));
    expect(mockDismissKeyboard).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(3);
  });
});
