/** @jest-environment jsdom */

import CustomInjectedOperationLogModal from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  getCustomInjectedOperationLogErrorAcknowledgedAt,
  setCustomInjectedOperationLogAppStartedAt,
  setCustomInjectedOperationLogVisibleAfter,
} from '@onekeyhq/kit/src/utils/customInjectedOperationLogRuntime';

const mockRouteParams: { sessionId: string } = {
  sessionId: 'session-1',
};

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({
    'aria-expanded': ariaExpanded,
    children,
    gap,
    numberOfLines,
    p,
    px,
    py,
    role,
    size,
    testID,
    title,
    onPress,
  }: {
    'aria-expanded'?: boolean;
    children?: React.ReactNode;
    gap?: string;
    numberOfLines?: number;
    p?: string;
    px?: string;
    py?: string;
    role?: string;
    size?: string;
    testID?: string;
    title?: React.ReactNode;
    onPress?: () => void;
  }) =>
    React.createElement(
      'div',
      {
        'aria-expanded': ariaExpanded,
        'data-gap': gap,
        'data-number-of-lines': numberOfLines,
        'data-padding': p,
        'data-padding-x': px,
        'data-padding-y': py,
        'data-size': size,
        'data-testid': testID,
        onClick: onPress,
        role,
      },
      title,
      children,
    );
  const Page = Object.assign(Container, {
    Body: Container,
    Footer: Container,
    Header: Container,
  });
  return {
    Button: ({
      'aria-pressed': ariaPressed,
      children,
      onPress,
      testID,
    }: {
      'aria-pressed'?: boolean;
      children?: React.ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          'aria-pressed': ariaPressed,
          'data-testid': testID,
          onClick: onPress,
          type: 'button',
        },
        children,
      ),
    IconButton: ({
      'aria-label': ariaLabel,
      icon,
      onPress,
      testID,
      title,
    }: {
      'aria-label'?: string;
      icon: string;
      onPress?: () => void;
      testID?: string;
      title?: string;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': ariaLabel,
          'data-testid': testID,
          'data-tooltip': title,
          onClick: onPress,
          type: 'button',
        },
        React.createElement('span', { 'data-icon-name': icon }),
      ),
    Page,
    Icon: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon-name': name }),
    ScrollView: Container,
    SizableText: Container,
    XStack: Container,
    YStack: Container,
  };
});

describe('CustomInjectedOperationLogModal', () => {
  beforeEach(() => {
    mockRouteParams.sessionId = 'session-1';
    setCustomInjectedOperationLogVisibleAfter(
      'session-1',
      Date.parse('2026-08-06T09:00:00.000Z'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads and refreshes recent operation logs', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-08-06T09:00:00.000Z'));
    const getCustomInjectedRecentOperationLogs = jest.fn().mockResolvedValue([
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T09:00:01.000Z',
        operationId: 'operation-0',
        operation: 'recording.save',
        status: 'result',
        result: { relativeFile: 'recordings/ether-fi.json' },
      },
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T09:00:02.000Z',
        operationId: 'operation-1',
        operation: 'e2e.generate',
        status: 'start',
      },
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T09:00:03.000Z',
        operationId: 'operation-2',
        operation: 'e2e.generate',
        status: 'error',
        error: { message: 'No unique locator resolved' },
      },
    ]);
    const openCustomInjectedOperationLogFile = jest
      .fn()
      .mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedRecentOperationLogs,
          openCustomInjectedOperationLogFile,
        },
      },
    });

    render(<CustomInjectedOperationLogModal />);

    await waitFor(() =>
      expect(
        screen.getByTestId('custom-injected-operation-logs').textContent,
      ).toContain('No unique locator resolved'),
    );
    expect(getCustomInjectedRecentOperationLogs).toHaveBeenCalledWith(
      'session-1',
    );
    const logContent = screen.getByTestId(
      'custom-injected-operation-logs',
    ).textContent;
    expect(logContent).toContain('No unique locator resolved');
    expect(logContent).not.toContain('Completed · recordings/ether-fi.json');
    expect(logContent).not.toContain('Operation started');
    expect(
      screen
        .getByTestId('custom-injected-operation-log-filter-all')
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      screen
        .getByTestId('custom-injected-operation-log-filter-error')
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen
        .getByTestId('custom-injected-operation-log-filter-info')
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      screen
        .getByTestId('custom-injected-operation-log-filter-success')
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      screen.getByTestId('custom-injected-operation-log-operation-2-error'),
    ).toBeTruthy();
    expect(
      screen
        .getByTestId('custom-injected-operation-log-operation-2-error')
        .getAttribute('data-gap'),
    ).toBe('$0.5');
    expect(
      screen
        .getByTestId('custom-injected-operation-log-operation-2-error')
        .getAttribute('data-padding-x'),
    ).toBe('$2');
    expect(
      screen
        .getByTestId('custom-injected-operation-log-operation-2-error')
        .getAttribute('data-padding-y'),
    ).toBe('$1');
    expect(
      screen
        .getByTestId('custom-injected-operation-logs')
        .getAttribute('data-gap'),
    ).toBe('$1');
    expect(
      screen.getByTestId('custom-injected-operation-log-status-filters')
        .textContent,
    ).not.toContain('Since');
    expect(screen.queryByText(/Live operation results/)).toBeNull();
    expect(
      screen.queryByTestId(
        'custom-injected-operation-log-operation-2-error-details',
      ),
    ).toBeNull();
    fireEvent.click(
      screen.getByTestId(
        'custom-injected-operation-log-operation-2-error-toggle',
      ),
    );
    expect(
      screen.getByTestId(
        'custom-injected-operation-log-operation-2-error-details',
      ).textContent,
    ).toContain('"message": "No unique locator resolved"');

    fireEvent.click(
      screen.getByTestId('custom-injected-operation-log-filter-success'),
    );
    expect(
      screen.getByTestId('custom-injected-operation-logs').textContent,
    ).toContain('Completed · recordings/ether-fi.json');
    expect(
      screen.getByTestId('custom-injected-operation-logs').textContent,
    ).toContain('No unique locator resolved');
    expect(
      screen.getByTestId('custom-injected-operation-logs').textContent,
    ).toContain('Generate E2E');

    fireEvent.click(
      screen.getByTestId('custom-injected-operation-log-filter-info'),
    );
    expect(
      screen.getByTestId('custom-injected-operation-log-operation-1-info'),
    ).toBeTruthy();
    expect(
      screen
        .getByTestId('custom-injected-operation-log-filter-all')
        .getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(
      screen.getByTestId('custom-injected-operation-log-filter-all'),
    );
    expect(
      screen.getByTestId('custom-injected-operation-logs').textContent,
    ).toContain('Completed · recordings/ether-fi.json');
    expect(
      screen.getByTestId('custom-injected-operation-log-operation-1-info'),
    ).toBeTruthy();

    expect(
      screen.getByTestId('custom-injected-operation-logs-clear').textContent,
    ).toBe('');
    expect(
      screen.getByTestId('custom-injected-operation-logs-refresh').textContent,
    ).toBe('');

    fireEvent.click(screen.getByTestId('custom-injected-operation-log-open'));
    await waitFor(() =>
      expect(openCustomInjectedOperationLogFile).toHaveBeenCalledWith(
        'session-1',
      ),
    );

    fireEvent.click(
      screen.getByTestId('custom-injected-operation-logs-refresh'),
    );
    await waitFor(() =>
      expect(getCustomInjectedRecentOperationLogs).toHaveBeenCalledTimes(3),
    );
  });

  test('starts at app launch time and only clear advances the badge cursor', async () => {
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-08-06T09:00:00.000Z'));
    const getCustomInjectedRecentOperationLogs = jest.fn().mockResolvedValue([
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T08:59:59.000Z',
        operationId: 'old-error',
        operation: 'e2e.generate',
        status: 'error',
        error: { message: 'Error before opening' },
      },
    ]);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedRecentOperationLogs,
          openCustomInjectedOperationLogFile: jest.fn(),
        },
      },
    });

    render(<CustomInjectedOperationLogModal />);

    await waitFor(() =>
      expect(getCustomInjectedRecentOperationLogs).toHaveBeenCalledWith(
        'session-1',
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('custom-injected-operation-logs').textContent,
      ).toContain('No new logs.'),
    );
    expect(
      screen.getByTestId('custom-injected-operation-logs').textContent,
    ).not.toContain('Error before opening');
    expect(getCustomInjectedOperationLogErrorAcknowledgedAt('session-1')).toBe(
      Date.parse('2026-08-06T09:00:00.000Z'),
    );

    nowSpy.mockReturnValue(Date.parse('2026-08-06T09:00:10.000Z'));
    fireEvent.click(screen.getByTestId('custom-injected-operation-logs-clear'));
    expect(getCustomInjectedOperationLogErrorAcknowledgedAt('session-1')).toBe(
      Date.parse('2026-08-06T09:00:10.000Z'),
    );
    getCustomInjectedRecentOperationLogs.mockResolvedValue([
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T08:59:59.000Z',
        operationId: 'old-error',
        operation: 'e2e.generate',
        status: 'error',
        error: { message: 'Error before opening' },
      },
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T09:00:09.000Z',
        operationId: 'cleared-error',
        operation: 'e2e.generate',
        status: 'error',
        error: { message: 'Error before clear' },
      },
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T09:00:11.000Z',
        operationId: 'new-error',
        operation: 'e2e.generate',
        status: 'error',
        error: { message: 'Error after clear' },
      },
    ]);
    fireEvent.click(
      screen.getByTestId('custom-injected-operation-logs-refresh'),
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('custom-injected-operation-logs').textContent,
      ).toContain('Error after clear'),
    );
    const visibleContent = screen.getByTestId(
      'custom-injected-operation-logs',
    ).textContent;
    expect(visibleContent).not.toContain('Error before opening');
    expect(visibleContent).not.toContain('Error before clear');
  });

  test('shows errors that occurred after app launch but before the modal opened', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-08-06T09:00:10.000Z'));
    const getCustomInjectedRecentOperationLogs = jest.fn().mockResolvedValue([
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T08:59:59.000Z',
        operationId: 'old-error',
        operation: 'e2e.generate',
        status: 'error',
        error: { message: 'Error before app launch' },
      },
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T09:00:05.000Z',
        operationId: 'unread-error',
        operation: 'e2e.generate',
        status: 'error',
        error: { message: 'Unread error from badge' },
      },
    ]);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedRecentOperationLogs,
          openCustomInjectedOperationLogFile: jest.fn(),
        },
      },
    });

    render(<CustomInjectedOperationLogModal />);

    await waitFor(() =>
      expect(
        screen.getByTestId('custom-injected-operation-logs').textContent,
      ).toContain('Unread error from badge'),
    );
    expect(
      screen.getByTestId('custom-injected-operation-logs').textContent,
    ).not.toContain('Error before app launch');
  });

  test('shows a persisted validation failure from before the current app launch', async () => {
    mockRouteParams.sessionId = 'historical-validation-session';
    const appStartedAt = Date.parse('2026-08-06T09:00:10.000Z');
    setCustomInjectedOperationLogAppStartedAt(appStartedAt);
    const getCustomInjectedRecentOperationLogs = jest.fn().mockResolvedValue([
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: '2026-08-06T09:00:05.000Z',
        operationId: 'historical-validation-failure',
        operation: 'e2e.validate',
        status: 'error',
        result: {
          passed: false,
          processLog: 'clean-session-1: repository icon not detected',
        },
        error: { message: 'E2E validation failed after 1 attempt' },
      },
    ]);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedRecentOperationLogs,
          openCustomInjectedOperationLogFile: jest.fn(),
        },
      },
    });

    render(<CustomInjectedOperationLogModal />);

    await waitFor(() =>
      expect(
        screen.getByTestId('custom-injected-operation-logs').textContent,
      ).toContain('E2E validation failed after 1 attempt'),
    );
    expect(
      screen.getByTestId(
        'custom-injected-operation-log-historical-validation-failure-error',
      ),
    ).toBeTruthy();
    expect(
      getCustomInjectedOperationLogErrorAcknowledgedAt(
        'historical-validation-session',
      ),
    ).toBe(appStartedAt);
  });
});
