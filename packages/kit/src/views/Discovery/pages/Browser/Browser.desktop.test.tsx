/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import {
  acquireCustomInjectedProtocolSelectionLock,
  resetCustomInjectedProtocolRuntimeForTest,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolRuntime';
import type {
  ICustomInjectedProtocol,
  ICustomInjectedSession,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import type { IDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { DesktopBrowser } from './Browser.desktop';

const mockSetWebTabData = jest.fn();
const mockAddBrowserHomeTab = jest.fn();
const mockGetDevSetting = jest.fn();
const mockUpdateDevSetting = jest.fn();
const mockActivateCustomInjectedWorkspace = jest.fn();
const mockDeactivateCustomInjectedWorkspace = jest.fn();
const mockSetActiveCustomInjectedWorkspace = jest.fn();
const mockLoadURL = jest.fn();
const mockSaveCustomInjectedRecording = jest.fn();
const mockPrepareCustomInjectedE2EValidation = jest.fn();
const mockGenerateCustomInjectedE2E = jest.fn();
const mockStopCustomInjectedE2EGeneration = jest.fn();
const mockProcessCustomInjectedAutoReview = jest.fn();
const mockLogCustomInjectedClientOperation = jest.fn();
const mockGetCustomInjectedWorkspace = jest.fn();
const mockUpdateCustomInjectedProtocol = jest.fn();
const mockDialogShow = jest.fn<
  {
    close: () => Promise<void>;
    getForm: () => undefined;
    isExist: () => boolean;
  },
  [unknown]
>();
const mockGenerateUUID = jest.fn((): string => 'test-token');
const mockWebviewRefs: Record<string, unknown> = {};

let mockActiveSession: ICustomInjectedSession | undefined;
let mockDevSettings: IDevSettingsPersistAtom;
let mockCurrentWebViewUrl = 'https://processed.example';
let mockActiveTabId = 'tab-1';
let mockTabs = [
  {
    id: 'tab-1',
    title: 'Unrelated site',
    type: 'web',
    url: 'https://unrelated.example',
  },
];
let mockProtocolSelectionListener:
  | ((
      protocol: ICustomInjectedProtocol,
      customSession: ICustomInjectedSession,
    ) => void)
  | undefined;
let mockDialogProps:
  | {
      description?: string;
      onCancel?: () => void;
      onConfirm?: () => Promise<void>;
      onCancelText?: string;
      onConfirmText?: string;
      renderContent?: React.ReactNode;
      showCancelButton?: boolean;
      title?: string;
    }
  | undefined;

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) => React.createElement('div', { 'data-testid': testID }, children);
  const Text = Container;
  const Page = Object.assign(Container, {
    Body: Container,
    Header: () => null,
  });
  return {
    Dialog: {
      show: (props: unknown) => mockDialogShow(props),
    },
    Icon: () => null,
    Page,
    SizableText: Text,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    Toast: {
      error: jest.fn(),
      success: jest.fn(),
      warning: jest.fn(),
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      getDevSetting: (...args: unknown[]) => {
        mockGetDevSetting(...args);
        return Promise.resolve(mockDevSettings);
      },
      updateDevSetting: (...args: unknown[]) => {
        mockUpdateDevSetting(...args);
        return Promise.resolve();
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserTabActions: () => ({
    current: {
      addBrowserHomeTab: mockAddBrowserHomeTab,
      setWebTabData: mockSetWebTabData,
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime', () => ({
  activateCustomInjectedWorkspace: (...args: unknown[]) => {
    mockActivateCustomInjectedWorkspace(...args);
    return Promise.resolve(mockActiveSession);
  },
  deactivateCustomInjectedWorkspace: (...args: unknown[]) => {
    mockDeactivateCustomInjectedWorkspace(...args);
    return Promise.resolve();
  },
  getActiveCustomInjectedWorkspace: () => mockActiveSession,
  setActiveCustomInjectedWorkspace: (...args: unknown[]) => {
    mockSetActiveCustomInjectedWorkspace(...args);
  },
  subscribeActiveCustomInjectedWorkspace: () => () => undefined,
  subscribeCustomInjectedProtocolSelection: (
    listener: (
      protocol: ICustomInjectedProtocol,
      customSession: ICustomInjectedSession,
    ) => void,
  ) => {
    mockProtocolSelectionListener = listener;
    return () => {
      if (mockProtocolSelectionListener === listener) {
        mockProtocolSelectionListener = undefined;
      }
    };
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [mockDevSettings],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    CreateNewBrowserTab: 'CreateNewBrowserTab',
  },
  appEventBus: {
    off: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/stringUtils', () => ({
  __esModule: true,
  default: { generateUUID: () => mockGenerateUUID() },
}));

jest.mock('../../components/CustomInjectedToolbar', () => ({
  __esModule: true,
  default: ({
    onStartRecording,
    onStopRecording,
    onStopE2EGeneration,
    onPrepareE2EPass,
    recordingPhase,
    e2eGenerating,
    selectedProtocolId,
    activeSession,
    onReload,
    onSelectProtocol,
  }: {
    onStartRecording: () => void;
    onStopRecording: () => void;
    onStopE2EGeneration: () => Promise<{ stopped: boolean }>;
    onPrepareE2EPass: () => void;
    recordingPhase?: string;
    e2eGenerating?: boolean;
    selectedProtocolId: string;
    activeSession: ICustomInjectedSession;
    onReload: (
      customSession: ICustomInjectedSession,
      expectedProtocolId: string,
    ) => void;
    onSelectProtocol: (
      protocol: ICustomInjectedProtocol,
      customSession: ICustomInjectedSession,
    ) => void;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement(
      'div',
      {
        'data-testid': 'custom-injected-toolbar',
        'data-recording-phase': recordingPhase,
        'data-e2e-generating': String(e2eGenerating === true),
        'data-review-state': activeSession.protocols.find(
          (protocol) => protocol.key === selectedProtocolId,
        )?.manualReview.state,
        'data-selected-protocol-id': selectedProtocolId,
      },
      React.createElement(
        'button',
        {
          'data-testid': 'select-next-protocol',
          onClick: () => {
            const protocol = activeSession.protocols[1];
            if (protocol) {
              onSelectProtocol(protocol, activeSession);
            }
          },
          type: 'button',
        },
        'select next',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'reload-protocol',
          onClick: () => onReload(activeSession, selectedProtocolId),
          type: 'button',
        },
        'reload',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'reload-stale-protocol',
          onClick: () => onReload(activeSession, 'defillama:protocol-2'),
          type: 'button',
        },
        'reload stale',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'toggle-recording',
          onClick:
            recordingPhase === 'recording' ? onStopRecording : onStartRecording,
          type: 'button',
        },
        recordingPhase || 'idle',
      ),
      e2eGenerating
        ? React.createElement(
            'button',
            {
              'data-testid': 'stop-e2e-generation',
              onClick: onStopE2EGeneration,
              type: 'button',
            },
            'stop generation',
          )
        : null,
      React.createElement(
        'button',
        {
          'data-testid': 'prepare-e2e-pass',
          onClick: onPrepareE2EPass,
          type: 'button',
        },
        'prepare e2e',
      ),
    );
  },
}));
jest.mock('../../components/HeaderRightToolBar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../hooks/useDAppNotifyChanges', () => ({
  useDAppNotifyChanges: jest.fn(),
}));
jest.mock('../../hooks/useWebTabs', () => ({
  useActiveTabId: () => ({ activeTabId: mockActiveTabId }),
  useWebTabDataById: (id: string) => ({
    tab: mockTabs.find((tab) => tab.id === id),
  }),
  useWebTabs: () => ({
    tabs: mockTabs,
  }),
}));
jest.mock('../../utils/explorerUtils', () => ({
  webviewRefs: new Proxy(
    {},
    {
      get: (_target, property: string) => mockWebviewRefs[property],
      set: (_target, property: string, value: unknown) => {
        mockWebviewRefs[property] = value;
        return true;
      },
    },
  ),
}));
jest.mock('../components/HistoryIconButton', () => ({
  HistoryIconButton: () => null,
}));
jest.mock('./DesktopBrowserContent', () => ({
  __esModule: true,
  default: function MockDesktopBrowserContent({
    id,
    customInjectionRecordingCommand,
    onCustomInjectionAutoReview,
    onCustomInjectionDidRedirectNavigation,
    onCustomInjectionDidStartNavigation,
    onCustomInjectionNavigationSettled,
    onCustomInjectionDomReady,
    onCustomInjectionRecordingEvent,
    partition,
    customInjectionUrl,
    customInjectionWebViewKey,
    customInjectionE2EPassKey,
    desktopPreloadUrl,
  }: {
    id: string;
    customInjectionRecordingCommand?: {
      action: 'start' | 'stop';
      token: string;
    };
    onCustomInjectionAutoReview?: (
      event: {
        iconLabel: string;
        pageUrl: string;
        webContentsId: number;
      },
      instanceKey?: string,
      e2ePassKey?: string,
    ) => void;
    onCustomInjectionDomReady?: (
      instanceKey?: string,
      e2ePassKey?: string,
    ) => void;
    onCustomInjectionDidRedirectNavigation?: (
      event: {
        isInPlace: boolean;
        isMainFrame: boolean;
        url: string;
      },
      instanceKey?: string,
    ) => void;
    onCustomInjectionDidStartNavigation?: (
      event: {
        isInPlace: boolean;
        isMainFrame: boolean;
        url: string;
      },
      instanceKey?: string,
    ) => void;
    onCustomInjectionNavigationSettled?: (
      loaded: boolean,
      instanceKey?: string,
    ) => void;
    onCustomInjectionRecordingEvent?: (event: unknown) => void;
    partition?: string;
    customInjectionUrl?: string;
    customInjectionWebViewKey?: string;
    customInjectionE2EPassKey?: string;
    desktopPreloadUrl?: string;
  }) {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      onCustomInjectionDomReady?.(
        customInjectionWebViewKey,
        customInjectionE2EPassKey,
      );
    }, [
      customInjectionE2EPassKey,
      customInjectionWebViewKey,
      onCustomInjectionDomReady,
    ]);
    const recording = {
      schemaVersion: 1,
      kind: 'onekey-connect-button-recording-capture',
      startedAt: '2026-08-03T00:00:00.000Z',
      finishedAt: '2026-08-03T00:00:01.000Z',
      initialUrl: 'https://processed.example',
      finalUrl: 'https://processed.example',
      title: 'Processed protocol',
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
      steps: [
        {
          action: 'click',
          elapsedMs: 100,
          pageUrl: 'https://processed.example',
          target: {
            tag: 'button',
            text: 'Connect Wallet',
            role: 'button',
            ariaLabel: null,
            selectors: [
              {
                kind: 'role',
                value: 'button:Connect Wallet',
                unique: true,
                role: 'button',
                name: 'Connect Wallet',
              },
            ],
          },
        },
      ],
    };
    return React.createElement(
      'div',
      {
        'data-testid': 'desktop-browser-content',
        'data-tab-id': id,
        'data-partition': partition,
        'data-recording-command': customInjectionRecordingCommand?.action,
        'data-custom-injection-url': customInjectionUrl,
        'data-desktop-preload-url': desktopPreloadUrl,
        'data-webview-instance-key': customInjectionWebViewKey,
        'data-e2e-pass-key': customInjectionE2EPassKey,
      },
      React.createElement(
        'button',
        {
          'data-testid': 'emit-protocol-navigation-start',
          onClick: () =>
            onCustomInjectionDidStartNavigation?.(
              {
                isInPlace: false,
                isMainFrame: true,
                url: 'https://processed.example',
              },
              customInjectionWebViewKey,
            ),
          type: 'button',
        },
        'emit protocol navigation start',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'emit-cross-domain-redirect',
          onClick: () => {
            mockCurrentWebViewUrl = 'https://redirected.example/connect';
            onCustomInjectionDidRedirectNavigation?.(
              {
                isInPlace: false,
                isMainFrame: true,
                url: mockCurrentWebViewUrl,
              },
              customInjectionWebViewKey,
            );
          },
          type: 'button',
        },
        'emit cross-domain redirect',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'emit-same-domain-redirect',
          onClick: () => {
            mockCurrentWebViewUrl = 'https://www.processed.example/connect';
            onCustomInjectionDidRedirectNavigation?.(
              {
                isInPlace: false,
                isMainFrame: true,
                url: mockCurrentWebViewUrl,
              },
              customInjectionWebViewKey,
            );
          },
          type: 'button',
        },
        'emit same-domain redirect',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'settle-protocol-navigation',
          onClick: () =>
            onCustomInjectionNavigationSettled?.(
              true,
              customInjectionWebViewKey,
            ),
          type: 'button',
        },
        'settle protocol navigation',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'emit-auto-review',
          onClick: () =>
            onCustomInjectionAutoReview?.(
              {
                iconLabel: 'OneKey',
                pageUrl: 'https://pending.example',
                webContentsId: 42,
              },
              customInjectionWebViewKey,
              customInjectionE2EPassKey,
            ),
          type: 'button',
        },
        'emit auto review',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'emit-stale-auto-review',
          onClick: () =>
            onCustomInjectionAutoReview?.(
              {
                iconLabel: 'OneKey',
                pageUrl: 'https://pending.example',
                webContentsId: 41,
              },
              customInjectionWebViewKey,
              undefined,
            ),
          type: 'button',
        },
        'emit stale auto review',
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'emit-recording-event',
          onClick: () =>
            onCustomInjectionRecordingEvent?.(
              customInjectionRecordingCommand?.action === 'stop'
                ? {
                    token: customInjectionRecordingCommand.token,
                    status: 'completed',
                    pageUrl: 'https://processed.example',
                    webContentsId: 42,
                    recording,
                  }
                : {
                    token: customInjectionRecordingCommand?.token,
                    status: 'started',
                    pageUrl: 'https://processed.example',
                    webContentsId: 42,
                  },
            ),
          type: 'button',
        },
        'emit',
      ),
    );
  },
}));
jest.mock('./DesktopBrowserNavigationContainer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./WithBrowserProvider', () => ({
  withBrowserProvider: (Component: unknown) => Component,
}));

const session: ICustomInjectedSession = {
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
      name: 'Processed protocol',
      slug: 'processed-protocol',
      url: 'https://processed.example',
      urlSource: 'registry',
      registryUrl: 'https://processed.example',
      registrySha256: 'a'.repeat(64),
      totalTvl: 200,
      bestRank: 1,
      manualReview: {
        state: 'processed',
        reviewedAt: '2026-07-31T00:00:00.000Z',
        reviewedUrl: 'https://processed.example',
        injectedBundleSha256: 'b'.repeat(64),
      },
    },
    {
      key: 'defillama:protocol-2',
      source: 'defillama',
      id: 'protocol-2',
      name: 'Pending protocol',
      slug: 'pending-protocol',
      url: 'https://pending.example',
      urlSource: 'registry',
      registryUrl: 'https://pending.example',
      registrySha256: 'a'.repeat(64),
      totalTvl: 100,
      bestRank: 2,
      manualReview: {
        state: 'pending',
        reviewedAt: null,
        reviewedUrl: null,
        injectedBundleSha256: null,
      },
    },
  ],
};

describe('DesktopBrowser Custom Injection progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCustomInjectedProtocolRuntimeForTest();
    let uuidCounter = 0;
    mockGenerateUUID.mockImplementation(() => {
      uuidCounter += 1;
      return `test-token-${String(uuidCounter)}`;
    });
    mockActiveSession = session;
    mockActiveTabId = 'tab-1';
    mockTabs = [
      {
        id: 'tab-1',
        title: 'Unrelated site',
        type: 'web',
        url: 'https://unrelated.example',
      },
    ];
    mockCurrentWebViewUrl = 'https://processed.example';
    mockProtocolSelectionListener = undefined;
    mockDialogProps = undefined;
    mockDialogShow.mockImplementation((props) => {
      mockDialogProps = props as typeof mockDialogProps;
      return {
        close: jest.fn().mockResolvedValue(undefined),
        getForm: () => undefined,
        isExist: () => true,
      };
    });
    mockGetCustomInjectedWorkspace.mockResolvedValue(session);
    mockWebviewRefs['tab-1'] = {
      innerRef: {
        getURL: () => mockCurrentWebViewUrl,
      },
      loadURL: mockLoadURL,
    };
    mockDevSettings = {
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace',
          lastSelectedProtocolId: 'protocol-1',
        },
      },
    };
    mockSaveCustomInjectedRecording.mockResolvedValue({
      relativeFile:
        'packages/connect-button-workbench/dapps/processed/recording.json',
      sha256: 'c'.repeat(64),
      stepCount: 1,
    });
    mockGenerateCustomInjectedE2E.mockResolvedValue({
      ok: true,
      relativeFile: 'packages/connect-button-workbench/dapps/processed/e2e.mjs',
      recordingSha256: 'c'.repeat(64),
      actionCount: 2,
      validated: true,
      validationPasses: 2,
    });
    mockPrepareCustomInjectedE2EValidation.mockResolvedValue({
      ...session,
      protocols: session.protocols.map((protocol) =>
        protocol.key === 'defillama:protocol-1'
          ? {
              ...protocol,
              manualReview: {
                state: 'pending' as const,
                reviewedAt: null,
                reviewedUrl: null,
                injectedBundleSha256: null,
              },
            }
          : protocol,
      ),
    });
    mockStopCustomInjectedE2EGeneration.mockResolvedValue({ stopped: true });
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          saveCustomInjectedRecording: mockSaveCustomInjectedRecording,
          generateCustomInjectedE2E: mockGenerateCustomInjectedE2E,
          prepareCustomInjectedE2EValidation:
            mockPrepareCustomInjectedE2EValidation,
          stopCustomInjectedE2EGeneration: mockStopCustomInjectedE2EGeneration,
          getCustomInjectedWorkspace: mockGetCustomInjectedWorkspace,
          logCustomInjectedClientOperation:
            mockLogCustomInjectedClientOperation,
          processCustomInjectedAutoReview: mockProcessCustomInjectedAutoReview,
          updateCustomInjectedProtocol: mockUpdateCustomInjectedProtocol,
        },
      },
    });
  });

  test('renders before a Custom Injection session is active', () => {
    mockActiveSession = undefined;

    expect(() => render(<DesktopBrowser />)).not.toThrow();
    expect(screen.getByTestId('desktop-browser-content')).toBeTruthy();
  });

  test('restores a legacy saved protocol ID and migrates it to a source key', async () => {
    render(<DesktopBrowser />);

    await waitFor(() =>
      expect(mockSetWebTabData).toHaveBeenCalledWith({
        id: 'tab-1',
        title: 'Processed protocol',
        url: 'https://processed.example',
      }),
    );
    expect(mockLoadURL).not.toHaveBeenCalled();
    expect(
      screen
        .getByTestId('desktop-browser-content')
        .getAttribute('data-custom-injection-url'),
    ).toBe('https://processed.example');
    expect(
      screen
        .getByTestId('desktop-browser-content')
        .getAttribute('data-webview-instance-key'),
    ).toBeTruthy();
    expect(
      screen
        .getByTestId('custom-injected-toolbar')
        .getAttribute('data-selected-protocol-id'),
    ).toBe('defillama:protocol-1');
    expect(mockUpdateDevSetting).toHaveBeenCalledWith('customInjection', {
      enabled: true,
      workspace: '/workspace',
      lastSelectedProtocolId: 'defillama:protocol-1',
    });
  });

  test('uses a popup target URL after the one-time initial protocol redirect', async () => {
    const view = render(<DesktopBrowser />);

    const ownerContent = await screen.findByTestId('desktop-browser-content');
    await waitFor(() =>
      expect(ownerContent.getAttribute('data-custom-injection-url')).toBe(
        'https://processed.example',
      ),
    );
    const ownerInstanceKey = ownerContent.getAttribute(
      'data-webview-instance-key',
    );
    fireEvent.click(screen.getByTestId('emit-protocol-navigation-start'));
    fireEvent.click(screen.getByTestId('settle-protocol-navigation'));
    mockTabs[0] = {
      ...mockTabs[0],
      title: 'Spiko',
      url: 'https://www.spiko.io/',
    };
    mockSetWebTabData.mockClear();
    view.rerender(<DesktopBrowser />);
    await waitFor(() =>
      expect(
        screen
          .getByTestId('desktop-browser-content')
          .getAttribute('data-custom-injection-url'),
      ).toBe('https://www.spiko.io/'),
    );
    expect(
      screen
        .getByTestId('desktop-browser-content')
        .getAttribute('data-webview-instance-key'),
    ).toBe(ownerInstanceKey);
    expect(mockSetWebTabData).not.toHaveBeenCalled();

    mockTabs = [
      mockTabs[0],
      {
        id: 'tab-2',
        title: 'Spiko sign in',
        type: 'web',
        url: 'https://app.spiko.io/signin?lang=en&mode=standard',
      },
    ];
    mockActiveTabId = 'tab-2';
    view.rerender(<DesktopBrowser />);

    await waitFor(() =>
      expect(screen.getAllByTestId('desktop-browser-content')).toHaveLength(2),
    );
    const contents = screen.getAllByTestId('desktop-browser-content');
    const originalTab = contents.find(
      (content) => content.getAttribute('data-tab-id') === 'tab-1',
    );
    const popupTab = contents.find(
      (content) => content.getAttribute('data-tab-id') === 'tab-2',
    );
    expect(originalTab?.getAttribute('data-custom-injection-url')).toBeNull();
    expect(popupTab?.getAttribute('data-custom-injection-url')).toBe(
      'https://app.spiko.io/signin?lang=en&mode=standard',
    );
    expect(popupTab?.getAttribute('data-desktop-preload-url')).toBe(
      'file:///workspace/injectedDesktopPreload.js',
    );
    expect(mockSetWebTabData).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tab-2' }),
    );
    expect(screen.getByTestId('custom-injected-toolbar')).toBeTruthy();

    mockActiveTabId = 'tab-1';
    view.rerender(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');
    const restoredOwner = screen
      .getAllByTestId('desktop-browser-content')
      .find((content) => content.getAttribute('data-tab-id') === 'tab-1');
    expect(restoredOwner?.getAttribute('data-custom-injection-url')).toBe(
      'https://www.spiko.io/',
    );
    expect(restoredOwner?.getAttribute('data-webview-instance-key')).not.toBe(
      ownerInstanceKey,
    );
  });

  test('falls back to the first pending protocol and persists it', async () => {
    mockDevSettings = {
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace',
          lastSelectedProtocolId: 'missing-protocol',
        },
      },
    };

    render(<DesktopBrowser />);

    await waitFor(() =>
      expect(mockUpdateDevSetting).toHaveBeenCalledWith('customInjection', {
        enabled: true,
        workspace: '/workspace',
        lastSelectedProtocolId: 'defillama:protocol-2',
      }),
    );
    expect(mockSetWebTabData).toHaveBeenCalledWith({
      id: 'tab-1',
      title: 'Pending protocol',
      url: 'https://pending.example',
    });
    expect(mockLoadURL).not.toHaveBeenCalled();
    expect(
      screen
        .getByTestId('desktop-browser-content')
        .getAttribute('data-custom-injection-url'),
    ).toBe('https://pending.example');
  });

  test('replaces the WebView for toolbar and protocol-list selections', async () => {
    render(<DesktopBrowser />);

    const content = await screen.findByTestId('desktop-browser-content');
    await waitFor(() =>
      expect(content.getAttribute('data-webview-instance-key')).toBeTruthy(),
    );
    const initialInstanceKey = content.getAttribute(
      'data-webview-instance-key',
    );

    fireEvent.click(screen.getByTestId('select-next-protocol'));

    await waitFor(() => {
      expect(content.getAttribute('data-custom-injection-url')).toBe(
        'https://pending.example',
      );
      expect(content.getAttribute('data-webview-instance-key')).not.toBe(
        initialInstanceKey,
      );
    });
    const nextInstanceKey = content.getAttribute('data-webview-instance-key');

    act(() => {
      mockProtocolSelectionListener?.(session.protocols[0], session);
    });

    await waitFor(() => {
      expect(content.getAttribute('data-custom-injection-url')).toBe(
        'https://processed.example',
      );
      expect(content.getAttribute('data-webview-instance-key')).not.toBe(
        nextInstanceKey,
      );
    });
    expect(mockLoadURL).not.toHaveBeenCalled();
  });

  test('rejects an unowned protocol switch while E2E owns the runtime', async () => {
    render(<DesktopBrowser />);

    const content = await screen.findByTestId('desktop-browser-content');
    await waitFor(() =>
      expect(content.getAttribute('data-custom-injection-url')).toBe(
        'https://processed.example',
      ),
    );
    const initialInstanceKey = content.getAttribute(
      'data-webview-instance-key',
    );
    let lock:
      | ReturnType<typeof acquireCustomInjectedProtocolSelectionLock>
      | undefined;
    act(() => {
      lock = acquireCustomInjectedProtocolSelectionLock({
        reason: 'pending E2E validation',
        sessionId: 'session-1',
      });
    });

    const pendingProtocol = session.protocols[1];
    if (!pendingProtocol) {
      throw new OneKeyLocalError('Expected pending protocol');
    }
    act(() => {
      mockProtocolSelectionListener?.(pendingProtocol, session);
    });

    expect(content.getAttribute('data-custom-injection-url')).toBe(
      'https://processed.example',
    );
    expect(content.getAttribute('data-webview-instance-key')).toBe(
      initialInstanceKey,
    );
    fireEvent.click(screen.getByTestId('prepare-e2e-pass'));
    await waitFor(() => {
      expect(content.getAttribute('data-partition')).toMatch(
        /^onekey-custom-e2e-/u,
      );
    });
    act(() => lock?.release());
  });

  test('replaces the WebView when reloading the current protocol', async () => {
    render(<DesktopBrowser />);

    const content = await screen.findByTestId('desktop-browser-content');
    await waitFor(() =>
      expect(content.getAttribute('data-webview-instance-key')).toBeTruthy(),
    );
    const initialInstanceKey = content.getAttribute(
      'data-webview-instance-key',
    );

    fireEvent.click(screen.getByTestId('reload-protocol'));

    await waitFor(() =>
      expect(content.getAttribute('data-webview-instance-key')).not.toBe(
        initialInstanceKey,
      ),
    );
    expect(content.getAttribute('data-custom-injection-url')).toBe(
      'https://processed.example',
    );
    expect(mockLoadURL).not.toHaveBeenCalled();
  });

  test('ignores a reload that completes after its protocol is no longer current', async () => {
    render(<DesktopBrowser />);

    const content = await screen.findByTestId('desktop-browser-content');
    await waitFor(() =>
      expect(content.getAttribute('data-webview-instance-key')).toBeTruthy(),
    );
    const initialInstanceKey = content.getAttribute(
      'data-webview-instance-key',
    );

    fireEvent.click(screen.getByTestId('reload-stale-protocol'));

    expect(content.getAttribute('data-webview-instance-key')).toBe(
      initialInstanceKey,
    );
    expect(content.getAttribute('data-custom-injection-url')).toBe(
      'https://processed.example',
    );
  });

  test('auto-review overrides an unsupported manual classification', async () => {
    const unsupportedSession: ICustomInjectedSession = {
      ...session,
      protocols: [
        session.protocols[0],
        {
          ...session.protocols[1],
          manualReview: {
            state: 'unsupported',
            reviewedAt: null,
            reviewedUrl: null,
            injectedBundleSha256: null,
          },
        },
      ],
    };
    const autoProcessedSession: ICustomInjectedSession = {
      ...unsupportedSession,
      protocols: [
        unsupportedSession.protocols[0],
        {
          ...unsupportedSession.protocols[1],
          manualReview: {
            state: 'processed',
            reviewedAt: '2026-08-05T00:00:00.000Z',
            reviewedUrl: 'https://pending.example',
            injectedBundleSha256: unsupportedSession.bundleSha256,
          },
        },
      ],
    };
    mockActiveSession = unsupportedSession;
    mockDevSettings = {
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace',
          lastSelectedProtocolId: 'protocol-2',
        },
      },
    };
    mockProcessCustomInjectedAutoReview.mockResolvedValue({
      session: autoProcessedSession,
      updated: true,
    });

    render(<DesktopBrowser />);

    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-toolbar')
          .getAttribute('data-selected-protocol-id'),
      ).toBe('defillama:protocol-2'),
    );
    fireEvent.click(screen.getByTestId('emit-auto-review'));

    await waitFor(() =>
      expect(mockProcessCustomInjectedAutoReview).toHaveBeenCalledWith({
        sessionId: 'session-1',
        protocolId: 'defillama:protocol-2',
        pageUrl: 'https://pending.example',
        webContentsId: 42,
        bundleSha256: 'b'.repeat(64),
        expectedRegistrySha256: 'a'.repeat(64),
        devSettingsEnabled: true,
        customInjectionEnabled: true,
      }),
    );
    expect(mockSetActiveCustomInjectedWorkspace).toHaveBeenCalledWith(
      autoProcessedSession,
    );
  });

  test('does not apply an auto-review response after switching protocols', async () => {
    const autoProcessedSession: ICustomInjectedSession = {
      ...session,
      protocols: [
        session.protocols[0],
        {
          ...session.protocols[1],
          manualReview: {
            state: 'processed',
            reviewedAt: '2026-08-05T00:00:00.000Z',
            reviewedUrl: 'https://pending.example',
            injectedBundleSha256: session.bundleSha256,
          },
        },
      ],
    };
    let resolveAutoReview:
      | ((result: {
          session: ICustomInjectedSession;
          updated: boolean;
        }) => void)
      | undefined;
    mockDevSettings = {
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace',
          lastSelectedProtocolId: 'protocol-2',
        },
      },
    };
    mockProcessCustomInjectedAutoReview.mockReturnValue(
      new Promise((resolve) => {
        resolveAutoReview = resolve;
      }),
    );

    render(<DesktopBrowser />);

    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-toolbar')
          .getAttribute('data-selected-protocol-id'),
      ).toBe('defillama:protocol-2'),
    );
    fireEvent.click(screen.getByTestId('emit-auto-review'));
    await waitFor(() =>
      expect(mockProcessCustomInjectedAutoReview).toHaveBeenCalledTimes(1),
    );

    act(() => {
      mockProtocolSelectionListener?.(session.protocols[0], session);
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-toolbar')
          .getAttribute('data-selected-protocol-id'),
      ).toBe('defillama:protocol-1'),
    );
    await act(async () => {
      resolveAutoReview?.({ session: autoProcessedSession, updated: true });
      await Promise.resolve();
    });

    expect(mockSetActiveCustomInjectedWorkspace).not.toHaveBeenCalledWith(
      autoProcessedSession,
    );
  });

  test('asks before saving a cross-domain protocol redirect', async () => {
    const redirectedUrl = 'https://redirected.example';
    const redirectedSession: ICustomInjectedSession = {
      ...session,
      registrySha256: 'c'.repeat(64),
      protocols: [
        {
          ...session.protocols[0],
          url: redirectedUrl,
          urlSource: 'override',
          registrySha256: 'c'.repeat(64),
          manualReview: {
            state: 'pending',
            reviewedAt: null,
            reviewedUrl: null,
            injectedBundleSha256: null,
          },
        },
        session.protocols[1],
      ],
    };
    mockUpdateCustomInjectedProtocol.mockResolvedValue(redirectedSession);

    render(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');
    fireEvent.click(screen.getByTestId('emit-protocol-navigation-start'));
    fireEvent.click(screen.getByTestId('emit-cross-domain-redirect'));
    fireEvent.click(screen.getByTestId('settle-protocol-navigation'));

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mockLogCustomInjectedClientOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
          protocolId: 'defillama:protocol-1',
          operation: 'protocol.redirect',
          status: 'error',
          input: {
            actualUrl: redirectedUrl,
            expectedUrl: 'https://processed.example',
          },
          error:
            'Custom injection protocol hostname mismatch for "defillama:protocol-1": actual="redirected.example" (redirected WebView), expected="processed.example" (selected protocol). Update the protocol URL to continue automatic review.',
        }),
      ),
    );
    expect(mockDialogProps).toEqual(
      expect.objectContaining({
        title: 'Protocol URL changed',
        showCancelButton: true,
        onCancelText: 'Keep old URL',
        onConfirmText: 'Update URL',
        renderContent: expect.anything(),
      }),
    );
    render(mockDialogProps?.renderContent as React.ReactElement);
    expect(
      screen.getByTestId('custom-injected-redirect-old-url').textContent,
    ).toBe('https://processed.example');
    expect(
      screen.getByTestId('custom-injected-redirect-new-url').textContent,
    ).toBe(redirectedUrl);
    expect(mockUpdateCustomInjectedProtocol).not.toHaveBeenCalled();

    await act(async () => {
      await mockDialogProps?.onConfirm?.();
    });

    expect(mockGetCustomInjectedWorkspace).toHaveBeenCalledWith('session-1');
    expect(mockUpdateCustomInjectedProtocol).toHaveBeenCalledWith({
      action: 'set-url',
      sessionId: 'session-1',
      protocolId: 'defillama:protocol-1',
      expectedRegistrySha256: 'a'.repeat(64),
      url: redirectedUrl,
    });
    expect(mockSetActiveCustomInjectedWorkspace).toHaveBeenCalledWith(
      redirectedSession,
    );
    expect(mockLoadURL).not.toHaveBeenCalled();
    expect(
      screen
        .getByTestId('desktop-browser-content')
        .getAttribute('data-custom-injection-url'),
    ).toBe(redirectedUrl);
  });

  test('keeps the registry unchanged when the redirect prompt is cancelled', async () => {
    render(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');
    fireEvent.click(screen.getByTestId('emit-protocol-navigation-start'));
    fireEvent.click(screen.getByTestId('emit-cross-domain-redirect'));
    fireEvent.click(screen.getByTestId('settle-protocol-navigation'));

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    mockDialogProps?.onCancel?.();
    expect(mockUpdateCustomInjectedProtocol).not.toHaveBeenCalled();
  });

  test('rejects confirmation after the WebView leaves the redirected domain', async () => {
    render(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');
    fireEvent.click(screen.getByTestId('emit-protocol-navigation-start'));
    fireEvent.click(screen.getByTestId('emit-cross-domain-redirect'));
    fireEvent.click(screen.getByTestId('settle-protocol-navigation'));

    mockCurrentWebViewUrl = 'https://other.example/';
    await expect(mockDialogProps?.onConfirm?.()).rejects.toThrow(
      'The page changed after the redirect was detected',
    );
    expect(mockGetCustomInjectedWorkspace).not.toHaveBeenCalled();
    expect(mockUpdateCustomInjectedProtocol).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockLogCustomInjectedClientOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'protocol.redirect.update',
          status: 'error',
          error: expect.stringContaining(
            'The page changed after the redirect was detected',
          ),
        }),
      ),
    );
  });

  test('prompts for www hostname redirects but not later page navigation', async () => {
    render(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');

    fireEvent.click(screen.getByTestId('emit-protocol-navigation-start'));
    fireEvent.click(screen.getByTestId('emit-same-domain-redirect'));
    fireEvent.click(screen.getByTestId('settle-protocol-navigation'));
    expect(mockDialogShow).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('emit-cross-domain-redirect'));
    fireEvent.click(screen.getByTestId('settle-protocol-navigation'));
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });

  test('records in a fresh non-persistent partition and saves through Desktop main', async () => {
    let resolveGeneration:
      | ((result: { ok: false; cancelled: true; error: string }) => void)
      | undefined;
    mockGenerateCustomInjectedE2E.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        }),
    );
    render(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');

    fireEvent.click(screen.getByTestId('toggle-recording'));
    await waitFor(() => {
      const content = screen.getByTestId('desktop-browser-content');
      expect(content.getAttribute('data-recording-command')).toBe('start');
      expect(content.getAttribute('data-partition')).toMatch(
        /^onekey-custom-recording-/u,
      );
      expect(content.getAttribute('data-partition')).not.toMatch(/^persist:/u);
    });

    fireEvent.click(screen.getByTestId('emit-recording-event'));
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-toolbar')
          .getAttribute('data-recording-phase'),
      ).toBe('recording'),
    );
    fireEvent.click(screen.getByTestId('toggle-recording'));
    await waitFor(() =>
      expect(
        screen
          .getByTestId('desktop-browser-content')
          .getAttribute('data-recording-command'),
      ).toBe('stop'),
    );
    fireEvent.click(screen.getByTestId('emit-recording-event'));

    await waitFor(() =>
      expect(mockSaveCustomInjectedRecording).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
          protocolId: 'defillama:protocol-1',
          pageUrl: 'https://processed.example',
          webContentsId: 42,
          bundleSha256: 'b'.repeat(64),
          devSettingsEnabled: true,
          customInjectionEnabled: true,
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen
          .getByTestId('desktop-browser-content')
          .getAttribute('data-partition'),
      ).toBeNull(),
    );
    await waitFor(() =>
      expect(mockGenerateCustomInjectedE2E).toHaveBeenCalledWith(
        'session-1',
        'defillama:protocol-1',
      ),
    );
    expect(mockPrepareCustomInjectedE2EValidation).toHaveBeenCalledWith(
      'session-1',
      'defillama:protocol-1',
    );
    expect(
      mockPrepareCustomInjectedE2EValidation.mock.invocationCallOrder[0] ?? 0,
    ).toBeLessThan(
      mockGenerateCustomInjectedE2E.mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      screen
        .getByTestId('custom-injected-toolbar')
        .getAttribute('data-review-state'),
    ).toBe('pending');
    expect(
      screen
        .getByTestId('custom-injected-toolbar')
        .getAttribute('data-e2e-generating'),
    ).toBe('true');
    fireEvent.click(screen.getByTestId('stop-e2e-generation'));
    await waitFor(() =>
      expect(mockStopCustomInjectedE2EGeneration).toHaveBeenCalledWith(
        'session-1',
        'defillama:protocol-1',
      ),
    );
    await act(async () => {
      resolveGeneration?.({
        ok: false,
        cancelled: true,
        error: 'E2E generation stopped by user',
      });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-toolbar')
          .getAttribute('data-e2e-generating'),
      ).toBe('false'),
    );
  });

  test('releases the recording partition when stop receives no response', async () => {
    render(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');

    fireEvent.click(screen.getByTestId('toggle-recording'));
    await waitFor(() =>
      expect(
        screen
          .getByTestId('desktop-browser-content')
          .getAttribute('data-recording-command'),
      ).toBe('start'),
    );
    fireEvent.click(screen.getByTestId('emit-recording-event'));
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-toolbar')
          .getAttribute('data-recording-phase'),
      ).toBe('recording'),
    );

    jest.useFakeTimers();
    try {
      fireEvent.click(screen.getByTestId('toggle-recording'));
      expect(
        screen
          .getByTestId('desktop-browser-content')
          .getAttribute('data-recording-command'),
      ).toBe('stop');

      act(() => {
        jest.advanceTimersByTime(15_000);
      });

      expect(
        screen
          .getByTestId('desktop-browser-content')
          .getAttribute('data-partition'),
      ).toBeNull();
      expect(
        screen
          .getByTestId('custom-injected-toolbar')
          .getAttribute('data-recording-phase'),
      ).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('creates a different non-persistent partition for every E2E pass', async () => {
    render(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');

    fireEvent.click(screen.getByTestId('prepare-e2e-pass'));
    let firstPartition = '';
    let firstPassKey = '';
    await waitFor(() => {
      const content = screen.getByTestId('desktop-browser-content');
      firstPartition = content.getAttribute('data-partition') || '';
      firstPassKey = content.getAttribute('data-e2e-pass-key') || '';
      expect(firstPartition).toMatch(/^onekey-custom-e2e-/u);
      expect(firstPartition).not.toMatch(/^persist:/u);
      expect(firstPassKey).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('prepare-e2e-pass'));
    await waitFor(() => {
      const content = screen.getByTestId('desktop-browser-content');
      const secondPartition = content.getAttribute('data-partition') || '';
      const secondPassKey = content.getAttribute('data-e2e-pass-key') || '';
      expect(secondPartition).toMatch(/^onekey-custom-e2e-/u);
      expect(secondPartition).not.toBe(firstPartition);
      expect(secondPassKey).toBeTruthy();
      expect(secondPassKey).not.toBe(firstPassKey);
    });
    expect(mockSetWebTabData).toHaveBeenLastCalledWith({
      id: 'tab-1',
      title: 'Processed protocol',
      url: 'https://processed.example',
    });
    await waitFor(() =>
      expect(mockLogCustomInjectedClientOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'e2e.clean-session.prepare',
          status: 'result',
          result: expect.objectContaining({ ready: true }),
        }),
      ),
    );
  });

  test('refreshes the external preload before creating a clean E2E pass', async () => {
    const refreshedSession: ICustomInjectedSession = {
      ...session,
      bundleSha256: 'c'.repeat(64),
      preloadUrl: `file:///workspace/injectedDesktopPreload.js?sha256=${'c'.repeat(64)}`,
    };
    mockGetCustomInjectedWorkspace.mockResolvedValue(refreshedSession);

    render(<DesktopBrowser />);
    await screen.findByTestId('custom-injected-toolbar');

    fireEvent.click(screen.getByTestId('prepare-e2e-pass'));

    await waitFor(() => {
      const content = screen.getByTestId('desktop-browser-content');
      expect(content.getAttribute('data-partition')).toMatch(
        /^onekey-custom-e2e-/u,
      );
      expect(content.getAttribute('data-desktop-preload-url')).toBe(
        refreshedSession.preloadUrl,
      );
    });
    expect(mockGetCustomInjectedWorkspace).toHaveBeenCalledWith('session-1');
    expect(mockSetActiveCustomInjectedWorkspace).toHaveBeenCalledWith(
      refreshedSession,
    );
  });

  test('ignores auto-review DOM results from the previous E2E pass', async () => {
    mockDevSettings = {
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace',
          lastSelectedProtocolId: 'protocol-2',
        },
      },
    };
    mockProcessCustomInjectedAutoReview.mockResolvedValue({
      session,
      updated: true,
    });

    render(<DesktopBrowser />);
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-toolbar')
          .getAttribute('data-selected-protocol-id'),
      ).toBe('defillama:protocol-2'),
    );

    fireEvent.click(screen.getByTestId('prepare-e2e-pass'));
    await waitFor(() =>
      expect(
        screen
          .getByTestId('desktop-browser-content')
          .getAttribute('data-e2e-pass-key'),
      ).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId('emit-stale-auto-review'));
    expect(mockProcessCustomInjectedAutoReview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('emit-auto-review'));
    await waitFor(() =>
      expect(mockProcessCustomInjectedAutoReview).toHaveBeenCalledTimes(1),
    );
  });
});
