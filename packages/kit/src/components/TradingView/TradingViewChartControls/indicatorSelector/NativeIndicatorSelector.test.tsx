/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { IndicatorListDialogContent } from './NativeIndicatorSelector';

const mockClose = jest.fn(() => Promise.resolve());

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) {
    return onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  }
  function MockContainer({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  return {
    Button: MockStack,
    XStack: MockStack,
    Stack: MockContainer,
    YStack: MockContainer,
    ScrollView: MockContainer,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    useDialogInstance: () => ({ close: mockClose }),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const indicators = [
  { label: 'MA', value: 'MA', active: false },
  { label: 'RSI', value: 'RSI', active: false },
];

describe('mobile indicator settings navigation', () => {
  beforeEach(() => {
    mockClose.mockReset();
    mockClose.mockResolvedValue(undefined);
  });

  it('commits pending main and sub selections before closing, then opens settings after close', async () => {
    const events: string[] = [];
    let finishClose: (() => void) | undefined;
    mockClose.mockImplementation(() => {
      events.push('close');
      return new Promise<void>((resolve) => {
        finishClose = resolve;
      });
    });
    const onSelectionConfirm = jest.fn(() => events.push('commit'));
    const onSettingsPress = jest.fn(() => events.push('settings'));
    const onSelect = jest.fn();
    render(
      <IndicatorListDialogContent
        indicators={indicators}
        onSelect={onSelect}
        onSelectionConfirm={onSelectionConfirm}
        onResetLayout={jest.fn()}
        onSettingsPress={onSettingsPress}
      />,
    );
    fireEvent.click(
      screen.getByTestId('trading-view-native-indicator-item-MA'),
    );
    fireEvent.click(
      screen.getByTestId('trading-view-native-indicator-item-RSI'),
    );
    expect(onSelectionConfirm).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByTestId('trading-view-native-indicators-settings-button'),
    );

    expect(onSelectionConfirm).toHaveBeenCalledWith({
      activeIndicatorValues: new Set(['MA', 'RSI']),
      replaceMainIndicators: true,
      replaceSubIndicators: true,
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(events).toEqual(['commit', 'close']);
    await act(async () => finishClose?.());
    expect(events).toEqual(['commit', 'close', 'settings']);
  });

  it('opens settings without committing when the selection is unchanged', async () => {
    const onSelectionConfirm = jest.fn();
    const onSelect = jest.fn();
    const onSettingsPress = jest.fn();
    render(
      <IndicatorListDialogContent
        indicators={indicators}
        onSelect={onSelect}
        onSelectionConfirm={onSelectionConfirm}
        onResetLayout={jest.fn()}
        onSettingsPress={onSettingsPress}
      />,
    );
    fireEvent.click(
      screen.getByTestId('trading-view-native-indicators-settings-button'),
    );
    await waitFor(() => expect(onSettingsPress).toHaveBeenCalledTimes(1));
    expect(onSelectionConfirm).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
