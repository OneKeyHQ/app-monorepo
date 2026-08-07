/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import DesktopBrowserContent from './DesktopBrowserContent';

const mockWebContentMounted = jest.fn();
const mockWebContentUnmounted = jest.fn();
const mockInstanceGuards = new Map<number, () => boolean>();
let mockWebContentInstanceCounter = 0;

jest.mock('react-freeze', () => ({
  Freeze: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('use-debounce', () => ({
  useThrottledCallback: (callback: unknown) => callback,
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    AnimatePresence: Container,
    IconButton: () => null,
    Input: () => null,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
  };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { ShowFindInWebPage: 'ShowFindInWebPage' },
  appEventBus: { off: jest.fn(), on: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: false },
}));

jest.mock('../../components/WebContent/WebContent', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockWebContent({
    isWebViewInstanceCurrent,
    onCustomInjectionDomReady,
    url,
  }: {
    isWebViewInstanceCurrent: () => boolean;
    onCustomInjectionDomReady?: () => void;
    url: string;
  }) {
    const [instanceId] = React.useState(() => {
      mockWebContentInstanceCounter += 1;
      return mockWebContentInstanceCounter;
    });
    mockInstanceGuards.set(instanceId, isWebViewInstanceCurrent);
    React.useEffect(() => {
      mockWebContentMounted(instanceId, url);
      return () => {
        mockWebContentUnmounted(instanceId, url);
      };
    }, [instanceId, url]);
    return React.createElement(
      'div',
      {
        'data-testid': 'web-content',
        'data-instance-id': String(instanceId),
        'data-url': url,
      },
      React.createElement(
        'button',
        {
          'data-testid': 'signal-dom-ready',
          onClick: onCustomInjectionDomReady,
          type: 'button',
        },
        'ready',
      ),
    );
  }
  return {
    __esModule: true,
    default: MockWebContent,
  };
});

jest.mock('../../hooks/useDiscoveryMessageHandler', () => ({
  useDiscoveryMessageHandler: () => ({ customReceiveHandler: jest.fn() }),
}));

jest.mock('../../hooks/useWebTabs', () => ({
  useShouldKeepWebViewAlive: () => true,
  useWebTabDataById: () => ({
    tab: { id: 'tab-1', type: 'web', url: 'https://ordinary.example' },
  }),
}));

jest.mock('../../utils/desktopWebviewCleanup', () => ({
  releaseDesktopWebviewResources: jest.fn(),
}));

jest.mock('../../utils/explorerUtils', () => ({ webviewRefs: {} }));

jest.mock('../Dashboard/DashboardContent', () => ({
  __esModule: true,
  default: () => null,
}));

describe('DesktopBrowserContent Custom Injection WebView lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInstanceGuards.clear();
    mockWebContentInstanceCounter = 0;
  });

  test('unmounts the old page before mounting a newly selected protocol', () => {
    const onCustomInjectionDomReady = jest.fn();
    const { rerender } = render(
      <DesktopBrowserContent
        id="tab-1"
        activeTabId="tab-1"
        customInjectionUrl="https://first.example"
        customInjectionWebViewKey="selection-1"
        desktopPreloadUrl="file:///custom-preload.js"
        onCustomInjectionDomReady={onCustomInjectionDomReady}
      />,
    );

    const firstInstanceId = Number(
      screen.getByTestId('web-content').getAttribute('data-instance-id'),
    );
    const firstGuard = mockInstanceGuards.get(firstInstanceId);
    expect(firstGuard?.()).toBe(true);
    fireEvent.click(screen.getByTestId('signal-dom-ready'));
    expect(onCustomInjectionDomReady).toHaveBeenLastCalledWith('selection-1');

    rerender(
      <DesktopBrowserContent
        id="tab-1"
        activeTabId="tab-1"
        customInjectionUrl="https://second.example"
        customInjectionWebViewKey="selection-2"
        desktopPreloadUrl="file:///custom-preload.js"
        onCustomInjectionDomReady={onCustomInjectionDomReady}
      />,
    );

    const secondInstanceId = Number(
      screen.getByTestId('web-content').getAttribute('data-instance-id'),
    );
    expect(secondInstanceId).not.toBe(firstInstanceId);
    expect(screen.getByTestId('web-content').getAttribute('data-url')).toBe(
      'https://second.example',
    );
    expect(mockWebContentUnmounted).toHaveBeenCalledWith(
      firstInstanceId,
      'https://first.example',
    );
    expect(mockWebContentMounted).toHaveBeenCalledWith(
      secondInstanceId,
      'https://second.example',
    );
    expect(firstGuard?.()).toBe(false);
    expect(mockInstanceGuards.get(secondInstanceId)?.()).toBe(true);
    fireEvent.click(screen.getByTestId('signal-dom-ready'));
    expect(onCustomInjectionDomReady).toHaveBeenLastCalledWith('selection-2');
  });
});
