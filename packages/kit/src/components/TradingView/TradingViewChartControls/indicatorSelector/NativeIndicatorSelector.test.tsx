/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { IndicatorListDialogContent } from './NativeIndicatorSelector';

const mockClose = jest.fn(() => Promise.resolve());
const mockToastError = jest.fn<void, [unknown]>();
const mockLogError = jest.fn<void, [string]>();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: (message: string) => mockLogError(message) } },
  },
}));

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    onPress,
    testID,
    disabled,
    loading,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    disabled?: boolean;
    loading?: boolean;
  }) {
    return onPress ? (
      <button
        type="button"
        data-testid={testID}
        onClick={onPress}
        disabled={disabled}
        aria-busy={loading}
      >
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
    Toast: { error: (options: unknown) => mockToastError(options) },
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
    mockToastError.mockClear();
    mockLogError.mockClear();
  });

  it('waits for pending main and sub selections to be committed before closing, then opens settings after close', async () => {
    const events: string[] = [];
    let finishCommit: (() => void) | undefined;
    let finishClose: (() => void) | undefined;
    mockClose.mockImplementation(() => {
      events.push('close');
      return new Promise<void>((resolve) => {
        finishClose = resolve;
      });
    });
    const onSelectionConfirm = jest.fn(() => {
      events.push('commit');
      return new Promise<void>((resolve) => {
        finishCommit = resolve;
      });
    });
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
    expect(events).toEqual(['commit']);
    await act(async () => finishCommit?.());
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

  it.each(['confirm', 'settings'] as const)(
    'reports a failed %s submission, preserves the selection, and allows retry',
    async (action) => {
      let rejectCommit: ((error: Error) => void) | undefined;
      const onSelectionConfirm = jest.fn(() => Promise.resolve());
      onSelectionConfirm.mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectCommit = reject;
          }),
      );
      const onSettingsPress = jest.fn();
      const onResetLayout = jest.fn();
      render(
        <IndicatorListDialogContent
          indicators={indicators}
          resetLayout={{ enabled: true, label: 'Reset layout' }}
          onSelect={jest.fn()}
          onSelectionConfirm={onSelectionConfirm}
          onResetLayout={onResetLayout}
          onSettingsPress={onSettingsPress}
        />,
      );
      fireEvent.click(
        screen.getByTestId('trading-view-native-indicator-item-MA'),
      );
      fireEvent.click(
        screen.getByTestId('trading-view-native-indicator-item-RSI'),
      );
      const button = screen.getByTestId(
        `trading-view-native-indicators-${action}-button`,
      ) as HTMLButtonElement;
      fireEvent.click(button);
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
      fireEvent.click(
        screen.getByTestId('trading-view-native-indicators-confirm-button'),
      );
      fireEvent.click(
        screen.getByTestId('trading-view-native-indicators-settings-button'),
      );
      fireEvent.click(
        screen.getByTestId(
          'trading-view-native-indicators-reset-layout-button',
        ),
      );
      fireEvent.click(
        screen.getByTestId('trading-view-native-indicator-item-MA'),
      );
      expect(onSelectionConfirm).toHaveBeenCalledTimes(1);
      expect(onResetLayout).not.toHaveBeenCalled();

      await act(async () => rejectCommit?.(new Error('Persistence failed')));
      expect(mockToastError).toHaveBeenCalledWith({
        title: ETranslations.global_an_error_occurred,
      });
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-busy')).toBe('false');
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('persist failed:'),
      );
      expect(mockClose).not.toHaveBeenCalled();
      expect(onSettingsPress).not.toHaveBeenCalled();

      fireEvent.click(button);
      await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
      expect(onSelectionConfirm).toHaveBeenCalledTimes(2);
      expect(onSelectionConfirm).toHaveBeenLastCalledWith({
        activeIndicatorValues: new Set(['MA', 'RSI']),
        replaceMainIndicators: true,
        replaceSubIndicators: true,
      });
      expect(onSettingsPress).toHaveBeenCalledTimes(
        action === 'settings' ? 1 : 0,
      );
      expect(mockToastError).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['MA', 'RSI'])(
    'persists a corrective selection after a failed optimistic %s write is reverted',
    async (indicator) => {
      const onSelectionConfirm = jest.fn(() => Promise.resolve());
      onSelectionConfirm.mockRejectedValueOnce(new Error('Storage failed'));
      render(
        <IndicatorListDialogContent
          indicators={indicators}
          onSelect={jest.fn()}
          onSelectionConfirm={onSelectionConfirm}
          onResetLayout={jest.fn()}
        />,
      );
      const pill = screen.getByTestId(
        `trading-view-native-indicator-item-${indicator}`,
      );
      const confirm = screen.getByTestId(
        'trading-view-native-indicators-confirm-button',
      );
      fireEvent.click(pill);
      fireEvent.click(confirm);
      await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
      fireEvent.click(pill);
      fireEvent.click(confirm);
      await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
      expect(onSelectionConfirm).toHaveBeenCalledTimes(2);
      expect(onSelectionConfirm).toHaveBeenLastCalledWith({
        activeIndicatorValues: new Set(),
        replaceMainIndicators: indicator === 'MA',
        replaceSubIndicators: indicator === 'RSI',
      });
    },
  );

  it.each(['close', 'navigate'])(
    'records a %s failure separately and does not repeat a successful write when retried',
    async (phase) => {
      const onSelectionConfirm = jest.fn(() => Promise.resolve());
      const onSettingsPress = jest.fn();
      if (phase === 'close') {
        mockClose.mockRejectedValueOnce(new Error('Close failed'));
      } else {
        onSettingsPress.mockImplementationOnce(() => {
          throw new OneKeyLocalError('Navigation failed');
        });
      }
      render(
        <IndicatorListDialogContent
          indicators={indicators}
          onSelect={jest.fn()}
          onSelectionConfirm={onSelectionConfirm}
          onResetLayout={jest.fn()}
          onSettingsPress={onSettingsPress}
        />,
      );
      fireEvent.click(
        screen.getByTestId('trading-view-native-indicator-item-MA'),
      );
      const settings = screen.getByTestId(
        'trading-view-native-indicators-settings-button',
      );
      fireEvent.click(settings);
      await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining(`${phase} failed:`),
      );
      fireEvent.click(settings);
      await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(2));
      expect(onSelectionConfirm).toHaveBeenCalledTimes(1);
      expect(onSettingsPress).toHaveBeenCalledTimes(phase === 'close' ? 1 : 2);
    },
  );
});
