/** @jest-environment jsdom */
// cspell:ignore defillama

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IDialogInstance } from '@onekeyhq/components/src/composite/Dialog';
import {
  resetCustomInjectedProtocolListFilter,
  setCustomInjectedProtocolListFilter,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolListFilterRuntime';
import {
  activateCustomInjectedProtocolRuntime,
  markCustomInjectedProtocolRuntimeReady,
  resetCustomInjectedProtocolRuntimeForTest,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolRuntime';
import type { ICustomInjectedSession } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

import CustomInjectedToolbar from './CustomInjectedToolbar.desktop';

const mockDialogShow = jest.fn();
const mockSetActiveCustomInjectedWorkspace = jest.fn();
const mockPushModal = jest.fn();
const mockToastError = jest.fn();

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: mockPushModal,
  }),
}));

jest.mock('@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime', () => ({
  setActiveCustomInjectedWorkspace: (...args: unknown[]) => {
    mockSetActiveCustomInjectedWorkspace(...args);
  },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({
    backgroundColor,
    bg,
    children,
    h,
    height,
    opacity,
    onPress,
    testID,
    w,
    width,
  }: {
    backgroundColor?: string;
    bg?: string;
    children?: React.ReactNode;
    h?: string;
    height?: number | string;
    opacity?: number;
    onPress?: () => void;
    testID?: string;
    w?: string;
    width?: number | string;
  }) =>
    React.createElement(
      'div',
      {
        'data-background-color': backgroundColor,
        'data-bg': bg,
        'data-height': height ?? h,
        'data-opacity': opacity,
        'data-testid': testID,
        'data-width': width ?? w,
        onClick: onPress,
      },
      children,
    );
  const Badge = Object.assign(
    ({
      badgeType,
      children,
      onPress,
      testID,
    }: {
      badgeType?: string;
      children?: React.ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'div',
        {
          'data-badge-type': badgeType,
          'data-testid': testID,
          onClick: onPress,
        },
        children,
      ),
    { Text: Container },
  );

  return {
    AnimatePresence: Container,
    Badge,
    Button: ({
      children,
      disabled,
      icon,
      onPress,
      testID,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      icon?: string;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          disabled,
          onClick: (event: React.MouseEvent) => {
            event.stopPropagation();
            onPress?.();
          },
          type: 'button',
        },
        icon ? React.createElement('span', { 'data-icon-name': icon }) : null,
        children,
      ),
    Dialog: {
      Form: ({
        children,
        formProps,
      }: {
        children?: React.ReactNode;
        formProps?: { values?: { url?: string } };
      }) =>
        React.createElement(
          'div',
          {
            'data-testid': 'dialog-form',
            'data-initial-url': formProps?.values?.url,
          },
          children,
        ),
      FormField: Container,
      show: (...args: unknown[]): IDialogInstance =>
        mockDialogShow(...args) as IDialogInstance,
    },
    Icon: ({
      color,
      name,
      size,
    }: {
      color?: string;
      name: string;
      size?: string;
    }) =>
      React.createElement('span', {
        'data-icon-color': color,
        'data-icon-name': name,
        'data-icon-size': size,
      }),
    Image: ({ source }: { source?: { uri?: string } }) =>
      React.createElement('img', {
        alt: '',
        'data-image-uri': source?.uri,
      }),
    IconButton: ({
      accessibilityState,
      bg,
      disabled,
      h,
      icon,
      iconProps,
      iconSize,
      loading,
      opacity,
      onPress,
      testID,
      title,
      variant,
      w,
    }: {
      accessibilityState?: { selected?: boolean };
      bg?: string;
      disabled?: boolean;
      h?: string;
      icon: string;
      iconProps?: { color?: string };
      iconSize?: number | string;
      loading?: boolean;
      opacity?: number;
      onPress?: (event: React.MouseEvent) => void;
      testID?: string;
      title?: string;
      variant?: string;
      w?: string;
    }) =>
      React.createElement(
        'button',
        {
          'data-selected': accessibilityState?.selected ? 'true' : 'false',
          'data-testid': testID,
          'data-title': title,
          'data-bg': bg,
          'data-height': h,
          'data-icon-color': iconProps?.color,
          'data-icon-size': iconSize,
          'data-opacity': opacity,
          'data-variant': variant,
          'data-width': w,
          disabled,
          onClick: (event: React.MouseEvent) => {
            event.stopPropagation();
            onPress?.(event);
          },
          type: 'button',
        },
        loading
          ? React.createElement('span', { 'data-loading': 'true' })
          : React.createElement('span', { 'data-icon-name': icon }),
      ),
    Input: () => null,
    ScrollView: Container,
    SizableText: Container,
    Spinner: ({ testID }: { testID?: string }) =>
      React.createElement('span', {
        'data-spinner': 'true',
        'data-testid': testID,
      }),
    Stack: Container,
    Toast: {
      error: (...args: unknown[]) => {
        mockToastError(...args);
      },
      success: jest.fn(),
    },
    Tooltip: ({ renderTrigger }: { renderTrigger: React.ReactNode }) =>
      renderTrigger,
    XStack: Container,
    YStack: Container,
  };
});

const processedSession: ICustomInjectedSession = {
  sessionId: 'session-1',
  workspace: '/workspace',
  registrySha256: 'a'.repeat(64),
  bundleSha256: 'b'.repeat(64),
  preloadUrl: 'file:///workspace/injectedDesktopPreload.js',
  sources: ['defillama'],
  dappsDirectory: 'packages/connect-button-workbench/dapps',
  protocols: [
    {
      key: 'defillama:protocol-1',
      source: 'defillama',
      id: 'protocol-1',
      name: 'Example',
      slug: 'example',
      url: 'https://example.com',
      urlSource: 'registry',
      registryUrl: 'https://defillama.example',
      registrySha256: 'a'.repeat(64),
      totalTvl: 100,
      bestRank: 1,
      manualReview: {
        state: 'processed',
        reviewedAt: '2026-07-31T00:00:00.000Z',
        reviewedUrl: 'https://example.com',
        injectedBundleSha256: 'b'.repeat(64),
      },
    },
  ],
};

const pendingSession: ICustomInjectedSession = {
  ...processedSession,
  registrySha256: 'c'.repeat(64),
  protocols: [
    {
      ...processedSession.protocols[0],
      registrySha256: 'c'.repeat(64),
      manualReview: {
        state: 'pending',
        reviewedAt: null,
        reviewedUrl: null,
        injectedBundleSha256: null,
      },
    },
  ],
};

const unsupportedSession: ICustomInjectedSession = {
  ...processedSession,
  registrySha256: 'd'.repeat(64),
  protocols: [
    {
      ...processedSession.protocols[0],
      registrySha256: 'd'.repeat(64),
      manualReview: {
        state: 'unsupported',
        reviewedAt: null,
        reviewedUrl: null,
        injectedBundleSha256: null,
      },
    },
  ],
};

describe('CustomInjectedToolbar automatic review state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCustomInjectedProtocolRuntimeForTest();
    resetCustomInjectedProtocolListFilter();
    mockDialogShow.mockReturnValue({
      close: jest.fn(),
      getForm: jest.fn(),
      isExist: jest.fn(() => true),
    });
  });

  test('shows three quick-switch icons and publishes unsupported directly', async () => {
    const updateCustomInjectedProtocol = jest
      .fn()
      .mockResolvedValue(unsupportedSession);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          updateCustomInjectedProtocol,
        },
      },
    });

    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={jest.fn()}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Custom Injection/u)).toBeNull();
    expect(screen.queryByText('defillama')).toBeNull();
    expect(
      screen.getByTestId('custom-injected-toolbar').getAttribute('data-bg'),
    ).toBe('$bgSuccess');
    expect(screen.getByTestId('custom-injected-edit-url').textContent).toBe('');
    expect(
      screen.getByTestId('custom-injected-toolbar-position').textContent,
    ).toBe('1 / 1');
    const navigationItems = Array.from(
      screen.getByTestId('custom-injected-toolbar-navigation').children,
    );
    expect(
      navigationItems[0]?.contains(
        screen.getByTestId('custom-injected-protocol-list'),
      ),
    ).toBe(true);
    expect(
      navigationItems[1]?.contains(
        screen.getByTestId('custom-injected-previous'),
      ),
    ).toBe(true);
    expect(navigationItems[2]).toBe(
      screen.getByTestId('custom-injected-toolbar-position'),
    );
    expect(
      navigationItems[3]?.contains(screen.getByTestId('custom-injected-next')),
    ).toBe(true);
    expect(
      screen.getByTestId('custom-injected-edit-url').getAttribute('data-title'),
    ).toBe('Edit protocol URL');
    expect(
      screen
        .getByTestId('custom-injected-edit-url')
        .querySelector('[data-icon-name="PencilOutline"]'),
    ).not.toBeNull();
    const expectedIcons = {
      pending: ['Pending · Needs review', 'ClockTimeHistoryOutline'],
      processed: [
        'Processed · Set by OneKey marker detection',
        'CheckRadioSolid',
      ],
      unsupported: ['Unsupported · No usable DApp', 'XCircleSolid'],
    } as const;
    for (const [state, [title, icon]] of Object.entries(expectedIcons)) {
      const option = screen.getByTestId(
        `custom-injected-review-state-${state}`,
      );
      expect(option.getAttribute('data-title')).toBe(title);
      expect(option.querySelector(`[data-icon-name="${icon}"]`)).not.toBeNull();
      expect(option.getAttribute('data-selected')).toBe(
        state === 'processed' ? 'true' : 'false',
      );
      expect(option.getAttribute('data-height')).toBe('$10');
      expect(option.getAttribute('data-icon-size')).toBe('$8');
      expect(option.getAttribute('data-opacity')).toBe(
        state === 'processed' ? '1' : '0.5',
      );
      expect(option.getAttribute('data-width')).toBe('$10');
      expect(option.getAttribute('data-variant')).toBe('secondary');
      expect(option.getAttribute('data-icon-color')).toBe(
        state === 'processed' ? '$iconSuccess' : '$iconSubdued',
      );
      expect(option.getAttribute('data-bg')).toBe(
        state === 'processed' ? '$bgSuccess' : '$transparent',
      );
    }

    expect(
      screen
        .getByTestId('custom-injected-review-state-processed')
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByTestId('custom-injected-review-state-pending')
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(
      screen
        .getByTestId('custom-injected-review-state-unsupported')
        .hasAttribute('disabled'),
    ).toBe(false);
    fireEvent.click(
      screen.getByTestId('custom-injected-review-state-processed'),
    );
    expect(updateCustomInjectedProtocol).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByTestId('custom-injected-review-state-unsupported'),
    );

    await waitFor(() =>
      expect(updateCustomInjectedProtocol).toHaveBeenCalledWith({
        action: 'set-review',
        sessionId: 'session-1',
        protocolId: 'defillama:protocol-1',
        expectedRegistrySha256: 'a'.repeat(64),
        state: 'unsupported',
      }),
    );
    expect(mockSetActiveCustomInjectedWorkspace).toHaveBeenCalledWith(
      unsupportedSession,
    );
    expect(mockDialogShow).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByTestId('custom-injected-operation-logs-button'),
    );
    expect(mockPushModal).toHaveBeenCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedOperationLogs',
      params: { sessionId: 'session-1' },
    });
    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(
      screen
        .getByTestId('custom-injected-review-state-unsupported')
        .getAttribute('data-selected'),
    ).toBe('true');
    expect(
      screen.getByTestId('custom-injected-toolbar').getAttribute('data-bg'),
    ).toBe('$bgCritical');
  });

  test('opens the virtualized protocol list modal', () => {
    const mixedSession: ICustomInjectedSession = {
      ...processedSession,
      protocols: [
        processedSession.protocols[0],
        {
          ...pendingSession.protocols[0],
          id: 'protocol-2',
          name: 'Pending example',
        },
        {
          ...unsupportedSession.protocols[0],
          id: 'protocol-3',
          name: 'Unsupported example',
        },
      ],
    };
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { webview: {} },
    });

    render(
      <CustomInjectedToolbar
        activeSession={mixedSession}
        activeBundleSha256={mixedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={mixedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={jest.fn()}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    for (const testID of [
      'custom-injected-previous',
      'custom-injected-protocol-list',
      'custom-injected-next',
      'custom-injected-reload',
      'custom-injected-operation-logs-button',
      'custom-injected-recording',
    ]) {
      expect(screen.getByTestId(testID).getAttribute('data-height')).toBe(
        '$10',
      );
      expect(screen.getByTestId(testID).getAttribute('data-icon-size')).toBe(
        '$8',
      );
      expect(screen.getByTestId(testID).getAttribute('data-width')).toBe('$10');
    }
    expect(
      screen
        .getByTestId('custom-injected-edit-url')
        .getAttribute('data-height'),
    ).toBe('$7');
    expect(
      screen
        .getByTestId('custom-injected-edit-url')
        .getAttribute('data-icon-size'),
    ).toBe('22');
    expect(
      screen.getByTestId('custom-injected-edit-url').getAttribute('data-width'),
    ).toBe('$7');
    for (const groupTestID of [
      'custom-injected-toolbar-navigation',
      'custom-injected-toolbar-utilities',
      'custom-injected-review-state',
    ]) {
      expect(screen.getByTestId(groupTestID).getAttribute('data-height')).toBe(
        '$11',
      );
    }
    expect(
      screen
        .getByTestId('custom-injected-e2e-workflow-summary')
        .getAttribute('data-width'),
    ).toBe('320');
    expect(
      screen.getByTestId('custom-injected-toolbar-navigation')
        .nextElementSibling,
    ).toBe(screen.getByTestId('custom-injected-toolbar-utilities'));

    fireEvent.click(screen.getByTestId('custom-injected-protocol-list'));
    expect(
      screen
        .getByTestId('custom-injected-protocol-list')
        .querySelector('[data-icon-name="BulletListOutline"]'),
    ).not.toBeNull();
    expect(mockPushModal).toHaveBeenCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedProtocolList',
      params: {
        selectedProtocolId: 'protocol-1',
        sessionId: 'session-1',
      },
    });
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  test('navigates and counts only protocols matching the shared filters', async () => {
    const baseProtocol = processedSession.protocols[0];
    const filteredSession: ICustomInjectedSession = {
      ...processedSession,
      protocols: [
        {
          ...baseProtocol,
          id: 'processed-1',
          key: 'defillama:processed-1',
          name: 'Processed one',
        },
        {
          ...baseProtocol,
          id: 'pending-1',
          key: 'defillama:pending-1',
          name: 'Pending one',
          manualReview: pendingSession.protocols[0].manualReview,
        },
        {
          ...baseProtocol,
          id: 'processed-2',
          key: 'defillama:processed-2',
          name: 'Processed two',
        },
        {
          ...baseProtocol,
          id: 'pending-2',
          key: 'defillama:pending-2',
          name: 'Pending two',
          manualReview: pendingSession.protocols[0].manualReview,
        },
      ],
    };
    setCustomInjectedProtocolListFilter({
      searchValue: '',
      sourceFilter: [],
      statusFilter: ['pending'],
      e2eFilter: {},
    });
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedWorkspace: jest
            .fn()
            .mockResolvedValue(filteredSession),
        },
      },
    });
    const onSelectProtocol = jest.fn();

    render(
      <CustomInjectedToolbar
        activeSession={filteredSession}
        activeBundleSha256={filteredSession.bundleSha256}
        selectedProtocolId="pending-1"
        sessionId={filteredSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={jest.fn()}
        onReload={jest.fn()}
        onSelectProtocol={onSelectProtocol}
      />,
    );

    expect(
      screen.getByTestId('custom-injected-toolbar-position').textContent,
    ).toBe('1 / 2');
    expect(
      screen.getByTestId('custom-injected-previous').hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByTestId('custom-injected-next').hasAttribute('disabled'),
    ).toBe(false);

    fireEvent.click(screen.getByTestId('custom-injected-next'));
    await waitFor(() =>
      expect(onSelectProtocol).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'defillama:pending-2' }),
        filteredSession,
      ),
    );
  });

  test('uses a clean session only when the reload control is command-clicked', async () => {
    const getCustomInjectedWorkspace = jest
      .fn()
      .mockResolvedValue(processedSession);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { webview: { getCustomInjectedWorkspace } },
    });
    const onPrepareE2EPass = jest.fn().mockResolvedValue(true);
    const onReload = jest.fn();

    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={onPrepareE2EPass}
        onReload={onReload}
        onSelectProtocol={jest.fn()}
      />,
    );

    const reloadButton = screen.getByTestId('custom-injected-reload');
    expect(reloadButton.getAttribute('data-title')).toBe(
      'Reload DApp & injection · ⌘-click for a clean session',
    );

    fireEvent.click(reloadButton, { metaKey: true });
    expect(onPrepareE2EPass).toHaveBeenCalledTimes(1);
    expect(getCustomInjectedWorkspace).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();

    fireEvent.click(reloadButton);
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));
    expect(getCustomInjectedWorkspace).toHaveBeenCalledTimes(1);
  });

  test('ignores a slower protocol selection after a newer click', async () => {
    const protocols = ['protocol-1', 'protocol-2', 'protocol-3'].map(
      (id, index) => ({
        ...processedSession.protocols[0],
        key: `defillama:${id}`,
        id,
        name: `Protocol ${String(index + 1)}`,
        url: `https://${id}.example`,
      }),
    );
    const mixedSession: ICustomInjectedSession = {
      ...processedSession,
      protocols,
    };
    const pendingRefreshes: Array<(session: ICustomInjectedSession) => void> =
      [];
    const getCustomInjectedWorkspace = jest.fn(
      () =>
        new Promise<ICustomInjectedSession>((resolve) => {
          pendingRefreshes.push(resolve);
        }),
    );
    const onSelectProtocol = jest.fn();
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { webview: { getCustomInjectedWorkspace } },
    });

    render(
      <CustomInjectedToolbar
        activeSession={mixedSession}
        activeBundleSha256={mixedSession.bundleSha256}
        selectedProtocolId="defillama:protocol-2"
        sessionId={mixedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => protocols[1].url)}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={jest.fn()}
        onReload={jest.fn()}
        onSelectProtocol={onSelectProtocol}
      />,
    );

    fireEvent.click(screen.getByTestId('custom-injected-previous'));
    fireEvent.click(screen.getByTestId('custom-injected-next'));
    expect(getCustomInjectedWorkspace).toHaveBeenCalledTimes(2);

    await act(async () => {
      pendingRefreshes[1]?.(mixedSession);
      await Promise.resolve();
    });
    expect(onSelectProtocol).toHaveBeenCalledWith(protocols[2], mixedSession);

    await act(async () => {
      pendingRefreshes[0]?.(mixedSession);
      await Promise.resolve();
    });
    expect(onSelectProtocol).toHaveBeenCalledTimes(1);
  });

  test('keeps the exact new-error badge when logs open', async () => {
    const cursor = Date.now();
    const getCustomInjectedRecentOperationLogs = jest.fn().mockResolvedValue([
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: new Date(cursor - 60_000).toISOString(),
        operationId: 'old-error',
        operation: 'e2e.generate',
        status: 'error',
      },
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: new Date(cursor + 60_000).toISOString(),
        operationId: 'new-error',
        operation: 'e2e.generate',
        status: 'error',
      },
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: new Date(cursor + 61_000).toISOString(),
        operationId: 'failed-validation',
        operation: 'e2e.validate',
        status: 'result',
        result: { passed: false },
      },
      {
        schemaVersion: 1,
        kind: 'onekey-custom-injection-operation',
        timestamp: new Date(cursor + 62_000).toISOString(),
        operationId: 'successful-operation',
        operation: 'recording.save',
        status: 'result',
      },
    ]);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedRecentOperationLogs,
        },
      },
    });

    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={jest.fn()}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('custom-injected-operation-logs-error-badge')
          .textContent,
      ).toBe('2'),
    );
    expect(getCustomInjectedRecentOperationLogs).toHaveBeenCalledWith(
      'session-1',
    );
    expect(
      screen
        .getByTestId('custom-injected-operation-logs-button')
        .getAttribute('data-title'),
    ).toBe('2 new errors · View logs');

    fireEvent.click(
      screen.getByTestId('custom-injected-operation-logs-button'),
    );
    expect(
      screen.getByTestId('custom-injected-operation-logs-error-badge')
        .textContent,
    ).toBe('2');
    expect(mockPushModal).toHaveBeenCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedOperationLogs',
      params: { sessionId: 'session-1' },
    });
  });

  test('animates when the review state becomes processed', async () => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { webview: {} },
    });
    const sharedProps = {
      activeBundleSha256: processedSession.bundleSha256,
      selectedProtocolId: 'protocol-1',
      sessionId: processedSession.sessionId,
      getCurrentWebViewUrl: jest.fn(() => 'https://example.com'),
      onStartRecording: jest.fn(),
      onStopRecording: jest.fn(),
      onPrepareE2EPass: jest.fn(),
      onReload: jest.fn(),
      onSelectProtocol: jest.fn(),
    };
    const { rerender } = render(
      <CustomInjectedToolbar activeSession={pendingSession} {...sharedProps} />,
    );

    expect(
      screen.queryByTestId('custom-injected-review-state-processed-pulse'),
    ).toBeNull();
    expect(
      screen.getByTestId('custom-injected-toolbar').getAttribute('data-bg'),
    ).toBe('$bgCaution');

    rerender(
      <CustomInjectedToolbar
        activeSession={processedSession}
        {...sharedProps}
      />,
    );

    expect(
      await screen.findByTestId('custom-injected-review-state-processed-pulse'),
    ).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-review-state-processed-ring'),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-review-state-processed')
        .getAttribute('data-selected'),
    ).toBe('true');
    expect(
      screen.getByTestId('custom-injected-toolbar').getAttribute('data-bg'),
    ).toBe('$bgSuccess');
  });

  test('marks only a custom URL override with a layered icon', () => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { webview: {} },
    });
    const overrideSession: ICustomInjectedSession = {
      ...processedSession,
      protocols: [
        {
          ...processedSession.protocols[0],
          urlSource: 'override',
        },
      ],
    };
    const sharedProps = {
      activeBundleSha256: processedSession.bundleSha256,
      selectedProtocolId: 'protocol-1',
      sessionId: processedSession.sessionId,
      getCurrentWebViewUrl: jest.fn(() => 'https://example.com'),
      onStartRecording: jest.fn(),
      onStopRecording: jest.fn(),
      onPrepareE2EPass: jest.fn(),
      onReload: jest.fn(),
      onSelectProtocol: jest.fn(),
    };
    const { rerender } = render(
      <CustomInjectedToolbar
        activeSession={overrideSession}
        {...sharedProps}
      />,
    );

    expect(
      document.querySelector('[data-icon-name="LayerBehindOutline"]'),
    ).not.toBeNull();

    rerender(
      <CustomInjectedToolbar
        activeSession={processedSession}
        {...sharedProps}
      />,
    );
    expect(
      document.querySelector('[data-icon-name="LayerBehindOutline"]'),
    ).toBeNull();
  });

  test('starts and stops recording while locking workspace-changing controls', () => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { webview: {} },
    });
    const onStartRecording = jest.fn();
    const onStopRecording = jest.fn();
    const sharedProps = {
      activeSession: processedSession,
      activeBundleSha256: processedSession.bundleSha256,
      selectedProtocolId: 'protocol-1',
      sessionId: processedSession.sessionId,
      getCurrentWebViewUrl: jest.fn(() => 'https://example.com'),
      onStartRecording,
      onStopRecording,
      onPrepareE2EPass: jest.fn(),
      onReload: jest.fn(),
      onSelectProtocol: jest.fn(),
    };
    const { rerender } = render(<CustomInjectedToolbar {...sharedProps} />);

    const inactiveRecordIcon = screen.getByTestId(
      'custom-injected-e2e-workflow-summary-status-icon',
    );
    expect(inactiveRecordIcon.getAttribute('data-background-color')).toBe(
      '$bgSubdued',
    );
    expect(inactiveRecordIcon.getAttribute('data-opacity')).toBe('0.5');
    expect(
      inactiveRecordIcon
        .querySelector('[data-icon-name="RecordCircleOutline"]')
        ?.getAttribute('data-icon-color'),
    ).toBe('$iconSubdued');
    expect(
      screen
        .getByTestId('custom-injected-recording')
        .querySelector('[data-icon-name="RecordCircleOutline"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByTestId('custom-injected-recording'));
    expect(onStartRecording).toHaveBeenCalledTimes(1);
    expect(mockDialogShow).not.toHaveBeenCalled();

    rerender(
      <CustomInjectedToolbar {...sharedProps} recordingPhase="recording" />,
    );
    expect(
      screen
        .getByTestId('custom-injected-recording')
        .getAttribute('data-title'),
    ).toBe('Stop recording');
    expect(
      screen
        .getByTestId('custom-injected-recording')
        .querySelector('[data-icon-name="StopCircleSolid"]'),
    ).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-reload').hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByTestId('custom-injected-edit-url').hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(screen.getByTestId('custom-injected-recording'));
    expect(onStopRecording).toHaveBeenCalledTimes(1);

    rerender(
      <CustomInjectedToolbar {...sharedProps} recordingPhase="saving" />,
    );
    expect(
      screen.getByTestId('custom-injected-recording').hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByTestId('custom-injected-recording')
        .getAttribute('data-title'),
    ).toBe('Saving recording…');
  });

  test('keeps the clean-session reset available and can stop automatic E2E generation', async () => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { webview: {} },
    });
    const onPrepareE2EPass = jest.fn().mockResolvedValue(true);
    const onStopE2EGeneration = jest.fn().mockResolvedValue({ stopped: true });
    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        e2eGenerating
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onStopE2EGeneration={onStopE2EGeneration}
        onPrepareE2EPass={onPrepareE2EPass}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    expect(screen.getByText('Generating…')).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-e2e-workflow-summary')
        .getAttribute('data-height'),
    ).toBe('60');
    expect(
      screen.getByTestId('custom-injected-edit-url').hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByTestId('custom-injected-e2e-reset').hasAttribute('disabled'),
    ).toBe(false);
    fireEvent.click(screen.getByTestId('custom-injected-e2e-reset'));
    expect(onPrepareE2EPass).toHaveBeenCalledTimes(1);

    const stopButton = screen.getByTestId(
      'custom-injected-e2e-generation-stop',
    );
    expect(stopButton.hasAttribute('disabled')).toBe(false);
    expect(stopButton.getAttribute('data-height')).toBe('$10');
    expect(stopButton.getAttribute('data-width')).toBe('$10');
    expect(
      stopButton.querySelector('[data-icon-name="StopCircleSolid"]'),
    ).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-e2e-generation-stop-spinner'),
    ).not.toBeNull();
    fireEvent.click(stopButton);
    const stopDialogProps = mockDialogShow.mock.calls[0]?.[0] as {
      description: string;
      onConfirm: () => Promise<void>;
      onConfirmText: string;
      title: string;
      tone: string;
    };
    expect(stopDialogProps).toEqual(
      expect.objectContaining({
        onConfirmText: 'Stop generation',
        title: 'Stop E2E generation?',
        tone: 'destructive',
      }),
    );
    expect(stopDialogProps.description).toContain(
      'The previous E2E will remain unchanged.',
    );
    await act(async () => {
      await stopDialogProps.onConfirm();
    });
    expect(onStopE2EGeneration).toHaveBeenCalledTimes(1);
    expect(stopButton.hasAttribute('disabled')).toBe(true);
    expect(stopButton.getAttribute('data-title')).toBe('Stopping…');
  });

  test('keeps the clean-session reset available during manual E2E validation', async () => {
    const runCustomInjectedE2E = jest.fn(() => new Promise(() => undefined));
    const stopCustomInjectedE2E = jest.fn().mockResolvedValue({
      stopped: true,
    });
    const prepareCustomInjectedE2EValidation = jest
      .fn()
      .mockResolvedValue(pendingSession);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedE2EState: jest.fn().mockResolvedValue({
            recording: {
              relativeFile:
                'packages/connect-button-workbench/dapps/example/recording.json',
              sha256: 'e'.repeat(64),
              stepCount: 1,
              finishedAt: '2026-08-05T00:00:00.000Z',
            },
            e2e: {
              relativeFile:
                'packages/connect-button-workbench/dapps/example/e2e.mjs',
              recordingSha256: 'e'.repeat(64),
              current: true,
            },
            canValidate: true,
          }),
          runCustomInjectedE2E,
          stopCustomInjectedE2E,
          prepareCustomInjectedE2EValidation,
        },
      },
    });
    const onPrepareE2EPass = jest.fn().mockResolvedValue(true);
    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={onPrepareE2EPass}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    await screen.findByText('Latest e2e.mjs ready');
    fireEvent.click(screen.getByTestId('custom-injected-e2e-validate'));
    await waitFor(() => expect(runCustomInjectedE2E).toHaveBeenCalledTimes(1));
    expect(prepareCustomInjectedE2EValidation).toHaveBeenCalledWith(
      'session-1',
      'defillama:protocol-1',
    );
    expect(onPrepareE2EPass).toHaveBeenCalledTimes(1);
    expect(onPrepareE2EPass.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      prepareCustomInjectedE2EValidation.mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      prepareCustomInjectedE2EValidation.mock.invocationCallOrder[0] ?? 0,
    ).toBeLessThan(runCustomInjectedE2E.mock.invocationCallOrder[0] ?? 0);
    expect(
      screen.getByTestId('custom-injected-e2e-reset').hasAttribute('disabled'),
    ).toBe(false);
    fireEvent.click(screen.getByTestId('custom-injected-e2e-reset'));
    expect(onPrepareE2EPass).toHaveBeenCalledTimes(2);
    const validationButton = screen.getByTestId('custom-injected-e2e-validate');
    expect(validationButton.hasAttribute('disabled')).toBe(false);
    expect(
      validationButton.querySelector('[data-icon-name="StopCircleSolid"]'),
    ).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-e2e-stop-spinner'),
    ).not.toBeNull();

    fireEvent.click(validationButton);
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    const stopDialogProps = mockDialogShow.mock.calls[0]?.[0] as {
      description: string;
      onConfirm: () => Promise<void>;
      onConfirmText: string;
      title: string;
      tone: string;
    };
    expect(stopDialogProps).toEqual(
      expect.objectContaining({
        onConfirmText: 'Stop validation',
        title: 'Stop E2E validation?',
        tone: 'destructive',
      }),
    );
    await act(async () => {
      await stopDialogProps.onConfirm();
    });
    expect(stopCustomInjectedE2E).toHaveBeenCalledWith(
      'session-1',
      'protocol-1',
    );
    expect(validationButton.hasAttribute('disabled')).toBe(true);
    expect(validationButton.getAttribute('data-title')).toBe('Stopping…');
  });

  test('prepares a fresh session before each consecutive validation', async () => {
    const runCustomInjectedE2E = jest.fn().mockResolvedValue({
      ok: false,
      error: 'Expected validation failure',
      log: 'Expected validation failure',
    });
    const prepareCustomInjectedE2EValidation = jest
      .fn()
      .mockResolvedValue(pendingSession);
    const onPrepareE2EPass = jest.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedE2EState: jest.fn().mockResolvedValue({
            recording: {
              relativeFile:
                'packages/connect-button-workbench/dapps/example/recording.json',
              sha256: 'e'.repeat(64),
              stepCount: 1,
              finishedAt: '2026-08-05T00:00:00.000Z',
            },
            e2e: {
              relativeFile:
                'packages/connect-button-workbench/dapps/example/e2e.mjs',
              recordingSha256: 'e'.repeat(64),
              current: true,
            },
            canValidate: true,
          }),
          runCustomInjectedE2E,
          prepareCustomInjectedE2EValidation,
        },
      },
    });

    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={onPrepareE2EPass}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    await screen.findByText('Latest e2e.mjs ready');
    const validate = screen.getByTestId('custom-injected-e2e-validate');
    fireEvent.click(validate);
    await waitFor(() => expect(runCustomInjectedE2E).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        validate.querySelector('[data-icon-name="PlayCircleOutline"]'),
      ).not.toBeNull(),
    );

    fireEvent.click(validate);
    await waitFor(() => expect(runCustomInjectedE2E).toHaveBeenCalledTimes(2));

    expect(onPrepareE2EPass).toHaveBeenCalledTimes(2);
    expect(prepareCustomInjectedE2EValidation).toHaveBeenCalledTimes(2);
    for (const index of [0, 1]) {
      expect(
        onPrepareE2EPass.mock.invocationCallOrder[index] ?? 0,
      ).toBeLessThan(
        prepareCustomInjectedE2EValidation.mock.invocationCallOrder[index] ?? 0,
      );
      expect(
        prepareCustomInjectedE2EValidation.mock.invocationCallOrder[index] ?? 0,
      ).toBeLessThan(runCustomInjectedE2E.mock.invocationCallOrder[index] ?? 0);
    }
  });

  test('starts the three-step workflow before recording', async () => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedE2EState: jest.fn().mockResolvedValue({
            recording: null,
            e2e: null,
            canValidate: false,
          }),
        },
      },
    });

    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={jest.fn()}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    await screen.findByText('recording.json');
    fireEvent.click(screen.getByTestId('custom-injected-e2e-workflow-summary'));
    expect(mockPushModal).toHaveBeenCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedE2EWorkflow',
      params: {
        e2eOutcome: undefined,
        protocolId: 'defillama:protocol-1',
        protocolName: 'Example',
        recordingPhase: undefined,
        sessionId: 'session-1',
      },
    });
    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(
      screen
        .getByTestId('custom-injected-recording')
        .getAttribute('data-title'),
    ).toBe('Record');
    expect(screen.queryByTestId('custom-injected-e2e-validate')).toBeNull();
  });

  test('shows the latest-only recording workflow and validates the current E2E', async () => {
    const protocolRuntimeScope = activateCustomInjectedProtocolRuntime({
      instanceKey: 'instance-1',
      protocolId: 'defillama:protocol-1',
      sessionId: 'session-1',
      tabId: 'tab-1',
    });
    markCustomInjectedProtocolRuntimeReady(protocolRuntimeScope);
    const getCustomInjectedE2EState = jest.fn().mockResolvedValue({
      recording: {
        relativeFile:
          'packages/connect-button-workbench/dapps/example/recording.json',
        sha256: 'e'.repeat(64),
        stepCount: 1,
        finishedAt: '2026-08-03T00:00:03.000Z',
      },
      e2e: {
        relativeFile: 'packages/connect-button-workbench/dapps/example/e2e.mjs',
        recordingSha256: 'e'.repeat(64),
        current: true,
      },
      canValidate: true,
    });
    const runCustomInjectedE2E = jest.fn().mockResolvedValue({
      ok: true,
      log: 'OneKey Desktop E2E validation\nExit code: 0',
      result: {
        schemaVersion: 1,
        kind: 'onekey-connect-button-desktop-e2e-result',
        passed: true,
        verdict: 'deterministic-repository-icon-source',
        validationMode: 'native-then-adapter',
        classification: 'native-onekey',
        maximumAttempts: 6,
        maximumAttemptsPerPhase: 3,
        nativeOneKeyAttempts: 2,
        adapterEnabledAttempts: 0,
        protocolId: 'protocol-1',
        site: 'example.com',
        recordingSha256: 'e'.repeat(64),
        passes: [
          {
            name: 'clean-session-1',
            passed: false,
            freshWebView: true,
            repositoryIconDetected: false,
            iconKey: null,
            iconLabel: null,
          },
          {
            name: 'clean-session-2',
            passed: true,
            freshWebView: true,
            repositoryIconDetected: true,
            iconKey: 'onekey',
            iconLabel: 'OneKey',
          },
        ],
      },
    });
    const prepareCustomInjectedE2EValidation = jest
      .fn()
      .mockResolvedValue(pendingSession);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedE2EState,
          runCustomInjectedE2E,
          prepareCustomInjectedE2EValidation,
        },
      },
    });

    const onPrepareE2EPass = jest.fn().mockResolvedValue(true);
    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={onPrepareE2EPass}
        protocolRuntimeScope={protocolRuntimeScope}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    await screen.findByText('Latest e2e.mjs ready');
    expect(
      screen.getByTestId('custom-injected-toolbar-e2e-statuses'),
    ).not.toBeNull();
    const toolbarE2EStatuses = {
      adapter: ['$bgSubdued', '0.5'],
      generated: ['$bgCaution', '1'],
      recorded: ['$bgInfo', '1'],
      validated: ['$bgSubdued', '0.5'],
    } as const;
    for (const [status, [backgroundColor, opacity]] of Object.entries(
      toolbarE2EStatuses,
    )) {
      const statusIcon = screen.getByTestId(
        `custom-injected-toolbar-e2e-statuses-${status}`,
      );
      expect(statusIcon.getAttribute('data-background-color')).toBe(
        backgroundColor,
      );
      expect(statusIcon.getAttribute('data-height')).toBe('$7');
      expect(statusIcon.getAttribute('data-opacity')).toBe(opacity);
      expect(statusIcon.getAttribute('data-width')).toBe('$7');
      expect(statusIcon.querySelector('[data-icon-size="$4"]')).not.toBeNull();
    }
    expect(
      screen
        .getByTestId('custom-injected-e2e-validate')
        .getAttribute('data-height'),
    ).toBe('$10');
    expect(
      screen
        .getByTestId('custom-injected-e2e-validate')
        .getAttribute('data-icon-size'),
    ).toBe('$8');
    expect(
      screen
        .getByTestId('custom-injected-e2e-validate')
        .getAttribute('data-width'),
    ).toBe('$10');
    fireEvent.click(screen.getByTestId('custom-injected-e2e-workflow-summary'));
    expect(mockPushModal).toHaveBeenCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedE2EWorkflow',
      params: {
        e2eOutcome: undefined,
        protocolId: 'defillama:protocol-1',
        protocolName: 'Example',
        recordingPhase: undefined,
        sessionId: 'session-1',
      },
    });
    fireEvent.click(screen.getByTestId('custom-injected-e2e-reset'));
    expect(onPrepareE2EPass).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByTestId('custom-injected-e2e-validate')
        .querySelector('[data-icon-name="PlayCircleOutline"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByTestId('custom-injected-e2e-validate'));
    await waitFor(() =>
      expect(runCustomInjectedE2E).toHaveBeenCalledWith(
        'session-1',
        'protocol-1',
      ),
    );
    expect(prepareCustomInjectedE2EValidation).toHaveBeenCalledWith(
      'session-1',
      'defillama:protocol-1',
    );
    expect(onPrepareE2EPass).toHaveBeenCalledTimes(2);
    expect(onPrepareE2EPass.mock.invocationCallOrder[1] ?? 0).toBeLessThan(
      prepareCustomInjectedE2EValidation.mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      prepareCustomInjectedE2EValidation.mock.invocationCallOrder[0] ?? 0,
    ).toBeLessThan(runCustomInjectedE2E.mock.invocationCallOrder[0] ?? 0);
    await screen.findByText('Passed · attempt 2 of 6');
    const completedValidationIcon = screen.getByTestId(
      'custom-injected-e2e-workflow-summary-status-icon',
    );
    expect(completedValidationIcon.getAttribute('data-background-color')).toBe(
      '$bgSuccess',
    );
    expect(completedValidationIcon.getAttribute('data-opacity')).toBe('1');
    expect(
      completedValidationIcon
        .querySelector('[data-icon-name="PlayCircleOutline"]')
        ?.getAttribute('data-icon-color'),
    ).toBe('$iconSuccess');
    expect(
      screen
        .getByTestId('custom-injected-e2e-validate')
        .getAttribute('data-title'),
    ).toBe('Run again');
    fireEvent.click(screen.getByTestId('custom-injected-e2e-workflow-summary'));
    expect(mockPushModal).toHaveBeenLastCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedE2EWorkflow',
      params: {
        e2eOutcome: {
          passed: true,
          text: 'Passed · attempt 2 of 6',
        },
        protocolId: 'defillama:protocol-1',
        protocolName: 'Example',
        recordingPhase: undefined,
        sessionId: 'session-1',
      },
    });

    const errorLog = [
      'OneKey Desktop E2E validation',
      'Exit code: 4',
      '--- stderr ---',
      '{"passed":false}',
    ].join('\n');
    runCustomInjectedE2E.mockResolvedValueOnce({
      ok: true,
      log: errorLog,
      result: {
        schemaVersion: 1,
        kind: 'onekey-connect-button-desktop-e2e-result',
        passed: false,
        verdict: 'deterministic-repository-icon-source',
        validationMode: 'native-then-adapter',
        classification: 'failed',
        maximumAttempts: 6,
        maximumAttemptsPerPhase: 3,
        nativeOneKeyAttempts: 2,
        adapterEnabledAttempts: 0,
        protocolId: 'protocol-1',
        site: 'example.com',
        recordingSha256: 'e'.repeat(64),
        passes: [
          {
            name: 'clean-session-1',
            passed: false,
            freshWebView: true,
            repositoryIconDetected: false,
            iconKey: null,
            iconLabel: null,
          },
          {
            name: 'clean-session-2',
            passed: false,
            freshWebView: true,
            repositoryIconDetected: false,
            iconKey: null,
            iconLabel: null,
          },
        ],
      },
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-e2e-validate')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByTestId('custom-injected-e2e-validate'));
    await screen.findByText('Open workflow to view error details');
    fireEvent.click(screen.getByTestId('custom-injected-e2e-workflow-summary'));
    expect(mockPushModal).toHaveBeenLastCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedE2EWorkflow',
      params: {
        e2eOutcome: {
          passed: false,
          text: 'Failed after 2 attempts',
          errorLog,
        },
        protocolId: 'defillama:protocol-1',
        protocolName: 'Example',
        recordingPhase: undefined,
        sessionId: 'session-1',
      },
    });

    const runtimeErrorLog = [
      'OneKey Desktop E2E validation',
      'Exit code: 4',
      '--- stderr ---',
      '{"ok":false,"error":"No unique locator resolved"}',
    ].join('\n');
    runCustomInjectedE2E.mockResolvedValueOnce({
      ok: false,
      error: 'No unique locator resolved',
      log: runtimeErrorLog,
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-e2e-validate')
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByTestId('custom-injected-e2e-validate'));
    await waitFor(() => expect(runCustomInjectedE2E).toHaveBeenCalledTimes(3));
    expect(mockToastError).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('custom-injected-e2e-workflow-summary'));
    expect(mockPushModal).toHaveBeenLastCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedE2EWorkflow',
      params: {
        e2eOutcome: {
          passed: false,
          text: 'Validation error',
          errorLog: runtimeErrorLog,
        },
        protocolId: 'defillama:protocol-1',
        protocolName: 'Example',
        recordingPhase: undefined,
        sessionId: 'session-1',
      },
    });
  });

  test('treats a re-recorded path as newer than the existing E2E', async () => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedE2EState: jest.fn().mockResolvedValue({
            recording: {
              relativeFile:
                'packages/connect-button-workbench/dapps/example/recording.json',
              sha256: 'f'.repeat(64),
              stepCount: 2,
              finishedAt: '2026-08-03T00:01:00.000Z',
            },
            e2e: {
              relativeFile:
                'packages/connect-button-workbench/dapps/example/e2e.mjs',
              recordingSha256: 'e'.repeat(64),
              current: false,
            },
            canValidate: false,
          }),
        },
      },
    });

    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={jest.fn(() => 'https://example.com')}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={jest.fn()}
        onReload={jest.fn()}
        onSelectProtocol={jest.fn()}
      />,
    );

    await screen.findByText('e2e.mjs');
    expect(screen.getByText('Re-record required')).not.toBeNull();
    fireEvent.click(screen.getByTestId('custom-injected-e2e-workflow-summary'));
    expect(mockPushModal).toHaveBeenCalledWith('DiscoveryModal', {
      screen: 'CustomInjectedE2EWorkflow',
      params: {
        e2eOutcome: undefined,
        protocolId: 'defillama:protocol-1',
        protocolName: 'Example',
        recordingPhase: undefined,
        sessionId: 'session-1',
      },
    });
    expect(screen.queryByTestId('custom-injected-e2e-validate')).toBeNull();
  });

  test('prefills the current WebView URL and can restore the DeFiLlama URL', async () => {
    const currentWebViewUrl = 'https://example.com/swap?output=eth#confirm';
    const updatedSession: ICustomInjectedSession = {
      ...pendingSession,
      protocols: [
        {
          ...pendingSession.protocols[0],
          url: currentWebViewUrl,
          urlSource: 'override',
        },
      ],
    };
    const updateCustomInjectedProtocol = jest
      .fn()
      .mockResolvedValue(updatedSession);
    const setValue = jest.fn();
    const getCurrentWebViewUrl = jest.fn(() => currentWebViewUrl);
    const onSelectProtocol = jest.fn();
    mockDialogShow.mockReturnValue({
      close: jest.fn(),
      getForm: () => ({ setValue }),
      isExist: jest.fn(() => true),
    });
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          updateCustomInjectedProtocol,
        },
      },
    });

    render(
      <CustomInjectedToolbar
        activeSession={processedSession}
        activeBundleSha256={processedSession.bundleSha256}
        selectedProtocolId="protocol-1"
        sessionId={processedSession.sessionId}
        getCurrentWebViewUrl={getCurrentWebViewUrl}
        onStartRecording={jest.fn()}
        onStopRecording={jest.fn()}
        onPrepareE2EPass={jest.fn()}
        onReload={jest.fn()}
        onSelectProtocol={onSelectProtocol}
      />,
    );

    fireEvent.click(screen.getByTestId('custom-injected-edit-url'));

    expect(getCurrentWebViewUrl).toHaveBeenCalledTimes(1);
    const dialogProps = mockDialogShow.mock.calls[0]?.[0] as {
      renderContent: React.ReactNode;
      onConfirm: (instance: {
        getForm: () => {
          getValues: (name: string) => string;
        };
      }) => Promise<void>;
    };
    render(dialogProps.renderContent);
    expect(
      screen.getByTestId('dialog-form').getAttribute('data-initial-url'),
    ).toBe(currentWebViewUrl);

    fireEvent.click(screen.getByTestId('custom-injected-reset-url'));
    expect(setValue).toHaveBeenCalledWith('url', 'https://defillama.example', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    await act(async () => {
      await dialogProps.onConfirm({
        getForm: () => ({
          getValues: () => currentWebViewUrl,
        }),
      });
    });
    expect(updateCustomInjectedProtocol).toHaveBeenCalledWith({
      action: 'set-url',
      sessionId: 'session-1',
      protocolId: 'defillama:protocol-1',
      expectedRegistrySha256: 'a'.repeat(64),
      url: currentWebViewUrl,
    });
    expect(onSelectProtocol).toHaveBeenCalledWith(
      updatedSession.protocols[0],
      updatedSession,
    );
  });
});
