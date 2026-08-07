/** @jest-environment jsdom */

import CustomInjectedProtocolListModal, {
  resetCustomInjectedProtocolListFilterMemory,
} from '.';

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import type { ICustomInjectedSession } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

const mockPop = jest.fn();
const mockRequestProtocolSelection = jest.fn();
const mockSetActiveWorkspace = jest.fn();
const mockScrollToIndex = jest.fn();
const mockScrollToOffset = jest.fn();
const mockGetWorkspace = jest.fn();
const mockGetE2EStates = jest.fn();
const mockRunE2E = jest.fn();
const mockUpdateProtocol = jest.fn();
const mockReleaseSelectionLock = jest.fn();
const mockWaitForRuntimeReady = jest.fn((_scope: unknown) =>
  Promise.resolve(true),
);
let mockActiveSession: ICustomInjectedSession | undefined;
let mockActiveRuntimeScope:
  | {
      instanceKey: string;
      protocolId: string;
      sessionId: string;
      tabId: string;
    }
  | undefined;
let mockRuntimeSequence = 0;

const session: ICustomInjectedSession = {
  sessionId: 'session-1',
  workspace: '/workspace',
  registrySha256: 'a'.repeat(64),
  bundleSha256: 'b'.repeat(64),
  preloadUrl: 'file:///workspace/injectedDesktopPreload.js',
  sources: ['defillama', 'custom'],
  dappsDirectory: '/workspace/dapps',
  protocols: [
    {
      key: 'defillama:aave',
      source: 'defillama',
      id: 'aave',
      name: 'Aave',
      slug: 'aave',
      url: 'https://app.aave.com',
      urlSource: 'registry',
      registryUrl: 'https://app.aave.com',
      registrySha256: 'a'.repeat(64),
      totalTvl: 1000,
      bestRank: 1,
      manualReview: {
        state: 'processed',
        reviewedAt: '2026-07-31T00:00:00.000Z',
        reviewedUrl: 'https://app.aave.com',
        injectedBundleSha256: 'b'.repeat(64),
      },
    },
    {
      key: 'defillama:compound',
      source: 'defillama',
      id: 'compound',
      name: 'Compound',
      slug: 'compound-finance',
      url: 'https://app.compound.finance',
      urlSource: 'override',
      registryUrl: null,
      registrySha256: 'a'.repeat(64),
      totalTvl: 800,
      bestRank: 2,
      manualReview: {
        state: 'pending',
        reviewedAt: null,
        reviewedUrl: null,
        injectedBundleSha256: null,
      },
    },
    {
      key: 'defillama:docs-only',
      source: 'defillama',
      id: 'docs-only',
      name: 'Docs Only',
      slug: 'docs-only',
      url: 'https://docs.example.com',
      urlSource: 'registry',
      registryUrl: 'https://docs.example.com',
      registrySha256: 'a'.repeat(64),
      totalTvl: 100,
      bestRank: 3,
      manualReview: {
        state: 'unsupported',
        reviewedAt: null,
        reviewedUrl: null,
        injectedBundleSha256: null,
      },
    },
    {
      key: 'custom:aave',
      source: 'custom',
      id: 'aave',
      name: 'Aave legacy adapter',
      slug: 'aave-v3',
      url: 'https://app.aave.com',
      urlSource: 'registry',
      registryUrl: 'https://app.aave.com',
      registrySha256: 'c'.repeat(64),
      totalTvl: 0,
      bestRank: null,
      manualReview: {
        state: 'pending',
        reviewedAt: null,
        reviewedUrl: null,
        injectedBundleSha256: null,
      },
    },
  ],
};

async function waitForE2EStatesToLoad() {
  await waitFor(() =>
    expect(
      screen
        .getByTestId('custom-injected-protocol-e2e-defillama-aave')
        .querySelector('[data-icon-name="PlayCircleOutline"]')
        ?.getAttribute('data-icon-color'),
    ).toBe('$iconSuccess'),
  );
}

function openFilterPanel() {
  fireEvent.click(screen.getByTestId('custom-injected-filter-panel-toggle'));
  expect(screen.getByTestId('custom-injected-filter-panel')).not.toBeNull();
}

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      selectedProtocolId: 'defillama:compound',
      sessionId: 'session-1',
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: mockPop }),
}));

jest.mock('@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime', () => ({
  getActiveCustomInjectedWorkspace: () => mockActiveSession,
  requestCustomInjectedProtocolSelection: (...args: unknown[]) => {
    mockRequestProtocolSelection(...args);
    const protocol = args[0] as { key: string };
    const customSession = args[1] as { sessionId: string };
    mockRuntimeSequence += 1;
    mockActiveRuntimeScope = {
      instanceKey: `runtime-${String(mockRuntimeSequence)}`,
      protocolId: protocol.key,
      sessionId: customSession.sessionId,
      tabId: 'tab-1',
    };
    return mockActiveRuntimeScope;
  },
  setActiveCustomInjectedWorkspace: (...args: unknown[]) => {
    mockSetActiveWorkspace(...args);
  },
  subscribeActiveCustomInjectedWorkspace: () => () => undefined,
}));

jest.mock('@onekeyhq/kit/src/utils/customInjectedProtocolRuntime', () => ({
  acquireCustomInjectedProtocolSelectionLock: () => ({
    reason: 'pending E2E validation',
    release: mockReleaseSelectionLock,
    sessionId: 'session-1',
    token: 'batch-lock',
  }),
  getActiveCustomInjectedProtocolRuntime: () => mockActiveRuntimeScope,
  isCustomInjectedProtocolRuntimeActive: (scope: { instanceKey: string }) =>
    scope.instanceKey === mockActiveRuntimeScope?.instanceKey,
  waitForCustomInjectedProtocolRuntimeReady: (scope: unknown) =>
    mockWaitForRuntimeReady(scope),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({
    backgroundColor,
    children,
    color,
    h,
    opacity,
    onPress,
    p,
    testID,
    w,
    width,
  }: {
    backgroundColor?: string;
    children?: React.ReactNode;
    color?: string;
    h?: string;
    opacity?: number;
    onPress?: () => void;
    p?: string;
    testID?: string;
    w?: number | string;
    width?: number | string;
  }) =>
    React.createElement(
      'div',
      {
        'data-background-color': backgroundColor,
        'data-color': color,
        'data-height': h,
        'data-opacity': opacity,
        'data-padding': p,
        'data-testid': testID,
        'data-width': w ?? width,
        onClick: onPress,
      },
      children,
    );
  const Badge = Object.assign(
    ({
      'aria-label': ariaLabel,
      badgeType,
      children,
      testID,
      title,
    }: {
      'aria-label'?: string;
      badgeType?: string;
      children?: React.ReactNode;
      testID?: string;
      title?: string;
    }) =>
      React.createElement(
        'span',
        {
          'aria-label': ariaLabel,
          'data-badge-type': badgeType,
          'data-testid': testID,
          title,
        },
        children,
      ),
    { Text: Container },
  );
  const Page = Object.assign(Container, {
    Body: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'page-body' }, children),
    Footer: Container,
    Header: ({
      headerRight,
      title,
    }: {
      headerRight?: () => React.ReactNode;
      title?: React.ReactNode;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'page-header' },
        title,
        headerRight ? headerRight() : null,
      ),
  });
  const ListView = React.forwardRef(
    (
      {
        data,
        estimatedItemSize,
        initialNumToRender,
        initialScrollIndex,
        keyExtractor,
        ListEmptyComponent,
        renderItem,
        testID,
        windowSize,
      }: {
        data: unknown[];
        estimatedItemSize: number;
        initialNumToRender: number;
        initialScrollIndex?: number;
        keyExtractor: (item: unknown, index: number) => string;
        ListEmptyComponent?: React.ReactNode;
        renderItem: (value: {
          item: unknown;
          index: number;
        }) => React.ReactNode;
        testID?: string;
        windowSize: number;
      },
      ref: React.ForwardedRef<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        scrollToIndex: mockScrollToIndex,
        scrollToOffset: mockScrollToOffset,
      }));
      return React.createElement(
        'div',
        {
          'data-estimated-item-size': estimatedItemSize,
          'data-initial-num-to-render': initialNumToRender,
          'data-initial-scroll-index': initialScrollIndex,
          'data-testid': testID,
          'data-window-size': windowSize,
        },
        data.length
          ? data.map((item, index) =>
              React.createElement(
                React.Fragment,
                { key: keyExtractor(item, index) },
                renderItem({ item, index }),
              ),
            )
          : ListEmptyComponent,
      );
    },
  );
  ListView.displayName = 'ListView';

  return {
    Badge,
    Button: ({
      'aria-label': ariaLabel,
      'aria-expanded': ariaExpanded,
      'aria-pressed': ariaPressed,
      backgroundColor,
      borderColor,
      children,
      disabled,
      h,
      onPress,
      testID,
      title,
      variant,
    }: {
      'aria-label'?: string;
      'aria-expanded'?: boolean;
      'aria-pressed'?: boolean;
      backgroundColor?: string;
      borderColor?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      h?: string;
      onPress?: () => void;
      testID?: string;
      title?: string;
      variant?: string;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': ariaLabel,
          'aria-expanded': ariaExpanded,
          'aria-pressed': ariaPressed,
          'data-background-color': backgroundColor,
          'data-border-color': borderColor,
          'data-height': h,
          'data-variant': variant,
          'data-testid': testID,
          disabled,
          onClick: onPress,
          title,
          type: 'button',
        },
        children,
      ),
    Empty: ({
      buttonProps,
      description,
      title,
    }: {
      buttonProps?: {
        children: React.ReactNode;
        onPress: () => void;
        testID?: string;
      };
      description?: React.ReactNode;
      title?: React.ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        title,
        description,
        buttonProps
          ? React.createElement(
              'button',
              {
                'data-testid': buttonProps.testID,
                onClick: buttonProps.onPress,
                type: 'button',
              },
              buttonProps.children,
            )
          : null,
      ),
    Icon: ({ color, name }: { color?: string; name: string }) =>
      React.createElement('span', {
        'data-icon-color': color,
        'data-icon-name': name,
      }),
    Image: ({
      source,
    }: {
      source?: {
        uri?: string;
      };
    }) =>
      React.createElement('img', {
        alt: '',
        'data-image-uri': source?.uri,
      }),
    HeaderButtonGroup: Container,
    IconButton: ({
      'aria-label': ariaLabel,
      disabled,
      icon,
      loading,
      onPress,
      testID,
      title,
    }: {
      'aria-label'?: string;
      disabled?: boolean;
      icon: string;
      loading?: boolean;
      onPress?: () => void;
      testID?: string;
      title?: string;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': ariaLabel,
          'data-loading': loading,
          'data-testid': testID,
          disabled,
          onClick: onPress,
          title,
          type: 'button',
        },
        React.createElement('span', { 'data-icon-name': icon }),
      ),
    ListView,
    Page,
    SearchBar: ({
      onSearchTextChange,
      testID,
      value,
    }: {
      onSearchTextChange: (value: string) => void;
      testID?: string;
      value: string;
    }) =>
      React.createElement('input', {
        'data-testid': testID,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onSearchTextChange(event.target.value),
        value,
      }),
    Progress: ({ value }: { value: number }) =>
      React.createElement('div', {
        'data-testid': 'review-progress',
        'data-value': value,
      }),
    SegmentControl: ({
      activeBackgroundColor,
      onChange,
      options,
      testID,
    }: {
      activeBackgroundColor: string;
      onChange: (value: string) => void;
      options: { label: React.ReactNode; testID: string; value: string }[];
      testID?: string;
    }) =>
      React.createElement(
        'div',
        {
          'data-active-background': activeBackgroundColor,
          'data-testid': testID,
        },
        options.map((option) =>
          React.createElement(
            'button',
            {
              'data-testid': option.testID,
              key: option.value,
              onClick: () => onChange(option.value),
              type: 'button',
            },
            option.label,
          ),
        ),
      ),
    SizableText: Container,
    Spinner: Container,
    Stack: Container,
    Toast: { error: jest.fn(), success: jest.fn() },
    Tooltip: ({
      renderContent,
      renderTrigger,
    }: {
      renderContent: React.ReactNode;
      renderTrigger: React.ReactNode;
    }) =>
      React.createElement(
        'span',
        {
          'data-tooltip-content':
            typeof renderContent === 'string' ? renderContent : undefined,
        },
        renderTrigger,
      ),
    XStack: Container,
    YStack: Container,
  };
});

describe('CustomInjectedProtocolListModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCustomInjectedProtocolListFilterMemory();
    mockActiveSession = session;
    mockRuntimeSequence = 0;
    mockActiveRuntimeScope = {
      instanceKey: 'runtime-original',
      protocolId: 'defillama:compound',
      sessionId: 'session-1',
      tabId: 'tab-1',
    };
    mockGetWorkspace.mockResolvedValue(session);
    mockUpdateProtocol.mockResolvedValue(session);
    mockGetE2EStates.mockResolvedValue({
      'defillama:aave': {
        adapter: true,
        recorded: true,
        generated: true,
        resultPresent: true,
        validated: true,
      },
      'defillama:compound': {
        adapter: false,
        recorded: true,
        generated: false,
        resultPresent: false,
        validated: false,
      },
      'custom:aave': {
        adapter: true,
        recorded: true,
        generated: true,
        resultPresent: false,
        validated: false,
      },
    });
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getCustomInjectedE2EStates: mockGetE2EStates,
          getCustomInjectedWorkspace: mockGetWorkspace,
          refreshCustomInjectedProtocols: jest.fn(),
          runCustomInjectedE2E: mockRunE2E,
          updateCustomInjectedProtocol: mockUpdateProtocol,
        },
      },
    });
  });

  test('uses a fixed-height virtual list and renders distinct statuses', async () => {
    render(<CustomInjectedProtocolListModal />);

    const pageHeader = screen.getByTestId('page-header');
    expect(
      within(pageHeader).getByTestId('custom-injected-protocol-search'),
    ).not.toBeNull();
    expect(
      within(pageHeader).getByTestId('custom-injected-filter-panel-toggle'),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId('page-body')).queryByTestId(
        'custom-injected-protocol-search',
      ),
    ).toBeNull();

    const list = screen.getByTestId('custom-injected-protocol-virtual-list');
    expect(list.getAttribute('data-estimated-item-size')).toBe('72');
    expect(list.getAttribute('data-initial-num-to-render')).toBe('12');
    expect(list.getAttribute('data-window-size')).toBe('7');
    expect(list.getAttribute('data-initial-scroll-index')).toBe('1');
    expect(screen.queryByTestId('custom-injected-filter-panel')).toBeNull();
    openFilterPanel();
    expect(
      screen
        .getByTestId('custom-injected-filter-panel')
        .getAttribute('data-padding'),
    ).toBe('$2');
    expect(screen.getByTestId('custom-injected-status-filters')).not.toBeNull();
    expect(screen.getByTestId('custom-injected-e2e-filters')).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-filter-all')
        .querySelector('[data-icon-name="BulletListOutline"]'),
    ).toBeNull();
    expect(
      screen.getByTestId('review-progress').getAttribute('data-value'),
    ).toBe('50');
    expect(
      screen
        .getByTestId('custom-injected-protocol-defillama-compound')
        .getAttribute('data-background-color'),
    ).toBe('$bgInfoSubdued');
    const currentBadge = screen.getByTestId(
      'custom-injected-protocol-current-defillama-compound',
    );
    expect(currentBadge.textContent).toBe('');
    expect(currentBadge.getAttribute('data-background-color')).toBeNull();
    expect(
      currentBadge
        .closest('[data-tooltip-content]')
        ?.getAttribute('data-tooltip-content'),
    ).toBe('Current protocol');
    const sequence = screen.getByTestId(
      'custom-injected-protocol-sequence-defillama-compound',
    );
    expect(
      currentBadge.closest('[data-tooltip-content]')?.parentElement
        ?.nextElementSibling,
    ).toBe(sequence);
    expect(
      currentBadge.querySelector('[data-icon-name="TargetCircleSolid"]'),
    ).not.toBeNull();
    const sourceBadge = screen.getByTestId(
      'custom-injected-protocol-source-defillama-compound',
    );
    expect(sourceBadge.textContent).toBe('');
    expect(sourceBadge.getAttribute('data-badge-type')).toBeNull();
    expect(
      sourceBadge
        .closest('[data-tooltip-content]')
        ?.getAttribute('data-tooltip-content'),
    ).toBe('Source: DeFiLlama');
    expect(
      sourceBadge.querySelector('[data-image-uri^="data:image/png;base64,"]'),
    ).not.toBeNull();
    const overrideBadge = screen.getByTestId(
      'custom-injected-protocol-override-defillama-compound',
    );
    expect(overrideBadge.textContent).toBe('');
    expect(overrideBadge.getAttribute('data-background-color')).toBeNull();
    expect(
      overrideBadge
        .closest('[data-tooltip-content]')
        ?.getAttribute('data-tooltip-content'),
    ).toBe('URL override');
    expect(
      overrideBadge.querySelector('[data-icon-name="LayerBehindOutline"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-source-all')
        .querySelector('[role="img"]'),
    ).toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-source-defillama-icon')
        .querySelector('[data-image-uri^="data:image/png;base64,"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-source-custom-icon')
        .querySelector('[data-icon-name="ToolboxOutline"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-protocol-source-custom-aave')
        .querySelector('[data-icon-name="ToolboxOutline"]'),
    ).not.toBeNull();

    expect(
      screen
        .getByTestId('custom-injected-protocol-status-defillama-aave')
        .getAttribute('data-background-color'),
    ).toBe('$bgSuccess');
    expect(
      screen
        .getByTestId('custom-injected-protocol-status-defillama-aave')
        .getAttribute('data-width'),
    ).toBe(
      screen
        .getByTestId('custom-injected-protocol-e2e-defillama-aave-recorded')
        .getAttribute('data-width'),
    );
    expect(
      screen
        .getByTestId('custom-injected-protocol-status-defillama-compound')
        .getAttribute('data-background-color'),
    ).toBe('$bgCaution');
    expect(
      screen
        .getByTestId('custom-injected-protocol-status-defillama-docs-only')
        .getAttribute('data-background-color'),
    ).toBe('$bgCritical');
    expect(
      screen
        .getByTestId('custom-injected-protocol-status-defillama-aave')
        .querySelector('[data-icon-name="CheckRadioSolid"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-protocol-status-defillama-aave')
        .closest('[data-tooltip-content]')
        ?.getAttribute('data-tooltip-content'),
    ).toBe('Status: Processed');
    expect(
      screen.getByTestId('custom-injected-protocol-status-defillama-aave')
        .textContent,
    ).toBe('');
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-protocol-e2e-defillama-aave')
          .querySelector('[data-icon-name="PlayCircleOutline"]')
          ?.getAttribute('data-icon-color'),
      ).toBe('$iconSuccess'),
    );
    const incompleteE2E = screen.getByTestId(
      'custom-injected-protocol-e2e-defillama-compound',
    );
    expect(
      screen
        .getByTestId('custom-injected-protocol-e2e-defillama-aave-adapter')
        .getAttribute('data-background-color'),
    ).toBe('$bgAccent');
    expect(
      screen
        .getByTestId('custom-injected-protocol-e2e-defillama-aave-adapter')
        .querySelector('[data-icon-name="PuzzleOutline"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('custom-injected-protocol-e2e-defillama-aave-adapter')
        .closest('[data-tooltip-content]')
        ?.getAttribute('data-tooltip-content'),
    ).toBe('Connect-button adapter implementation for this protocol.');
    expect(
      incompleteE2E
        .querySelector('[data-icon-name="RecordCircleOutline"]')
        ?.getAttribute('data-icon-color'),
    ).toBe('$iconInfo');
    expect(
      incompleteE2E
        .querySelector('[data-icon-name="CodeBracketsOutline"]')
        ?.getAttribute('data-icon-color'),
    ).toBe('$iconSubdued');
    expect(
      screen
        .getByTestId(
          'custom-injected-protocol-e2e-defillama-compound-generated',
        )
        .getAttribute('data-background-color'),
    ).toBe('$bgSubdued');
    expect(
      screen
        .getByTestId(
          'custom-injected-protocol-e2e-defillama-compound-generated',
        )
        .getAttribute('data-opacity'),
    ).toBe('0.5');
  });

  test('validates generated E2Es that have not passed sequentially', async () => {
    let resolveFirstRun: (value: unknown) => void = () => undefined;
    const firstRun = new Promise((resolve) => {
      resolveFirstRun = resolve;
    });
    const initialStates = {
      'defillama:aave': {
        adapter: true,
        recorded: true,
        generated: true,
        resultPresent: true,
        validated: true,
      },
      'defillama:compound': {
        adapter: false,
        recorded: true,
        generated: true,
        resultPresent: false,
        validated: false,
      },
      'defillama:docs-only': {
        adapter: false,
        recorded: true,
        generated: true,
        resultPresent: false,
        validated: false,
      },
      'custom:aave': {
        adapter: true,
        recorded: true,
        generated: true,
        resultPresent: true,
        validated: false,
      },
    };
    const completedStates = Object.fromEntries(
      Object.entries(initialStates).map(([key, value]) => [
        key,
        key === 'defillama:compound' ||
        key === 'defillama:docs-only' ||
        key === 'custom:aave'
          ? { ...value, resultPresent: true, validated: true }
          : value,
      ]),
    );
    mockGetE2EStates
      .mockResolvedValueOnce(initialStates)
      .mockResolvedValueOnce(completedStates);
    mockRunE2E
      .mockImplementationOnce(() => firstRun)
      .mockResolvedValueOnce({ ok: true, result: { passed: true } })
      .mockResolvedValueOnce({ ok: true, result: { passed: true } });

    render(<CustomInjectedProtocolListModal />);

    const button = await screen.findByTestId(
      'custom-injected-validate-pending-e2e',
    );
    await waitFor(() =>
      expect(button.getAttribute('aria-label')).toBe(
        'Validate pending E2E (3)',
      ),
    );
    expect(
      within(
        screen.getByTestId('custom-injected-protocol-list-footer'),
      ).getByTestId('custom-injected-validate-pending-e2e'),
    ).toBe(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockRunE2E).toHaveBeenCalledTimes(1);
      expect(mockRunE2E).toHaveBeenCalledWith(
        'session-1',
        'defillama:compound',
      );
      expect(mockRequestProtocolSelection).toHaveBeenCalledWith(
        session.protocols[1],
        session,
        { lockToken: 'batch-lock' },
      );
      expect(button.getAttribute('aria-label')).toBe('Validating 1 / 3');
    });
    fireEvent.click(
      screen.getByTestId('custom-injected-protocol-defillama-aave'),
    );
    expect(mockRequestProtocolSelection).toHaveBeenCalledTimes(1);
    resolveFirstRun({ ok: true, result: { passed: true } });

    await waitFor(() => {
      expect(mockRunE2E.mock.calls).toEqual([
        ['session-1', 'defillama:compound'],
        ['session-1', 'defillama:docs-only'],
        ['session-1', 'custom:aave'],
      ]);
      expect(mockRequestProtocolSelection.mock.calls).toEqual([
        [session.protocols[1], session, { lockToken: 'batch-lock' }],
        [session.protocols[2], session, { lockToken: 'batch-lock' }],
        [session.protocols[3], session, { lockToken: 'batch-lock' }],
        [session.protocols[1], session, { lockToken: 'batch-lock' }],
      ]);
      expect(mockUpdateProtocol.mock.calls).toEqual([
        [
          {
            action: 'set-review',
            sessionId: 'session-1',
            protocolId: 'defillama:compound',
            expectedRegistrySha256: 'a'.repeat(64),
            state: 'pending',
          },
        ],
        [
          {
            action: 'set-review',
            sessionId: 'session-1',
            protocolId: 'defillama:docs-only',
            expectedRegistrySha256: 'a'.repeat(64),
            state: 'pending',
          },
        ],
        [
          {
            action: 'set-review',
            sessionId: 'session-1',
            protocolId: 'custom:aave',
            expectedRegistrySha256: 'c'.repeat(64),
            state: 'pending',
          },
        ],
      ]);
      for (let index = 0; index < 3; index += 1) {
        expect(
          mockWaitForRuntimeReady.mock.invocationCallOrder[index],
        ).toBeLessThan(mockRunE2E.mock.invocationCallOrder[index]);
        expect(mockUpdateProtocol.mock.invocationCallOrder[index]).toBeLessThan(
          mockRunE2E.mock.invocationCallOrder[index],
        );
      }
      expect(mockReleaseSelectionLock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() =>
      expect(button.getAttribute('aria-label')).toBe(
        'Validate pending E2E (0)',
      ),
    );
  });

  test('filters by search and status', async () => {
    render(<CustomInjectedProtocolListModal />);
    await waitForE2EStatesToLoad();
    openFilterPanel();

    fireEvent.change(screen.getByTestId('custom-injected-protocol-search'), {
      target: { value: 'compound.finance' },
    });
    await waitFor(() => {
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-aave'),
      ).toBeNull();
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-compound'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId('custom-injected-filter-unsupported'));
    await waitFor(() => {
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-compound'),
      ).toBeNull();
    });

    fireEvent.click(screen.getByTestId('custom-injected-clear-filters'));
    await waitFor(() => {
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-aave'),
      ).not.toBeNull();
    });
  });

  test('multi-selects review statuses and E2E workflow badges', async () => {
    render(<CustomInjectedProtocolListModal />);
    await waitForE2EStatesToLoad();
    openFilterPanel();

    fireEvent.click(screen.getByTestId('custom-injected-filter-pending'));
    fireEvent.click(screen.getByTestId('custom-injected-filter-unsupported'));

    await waitFor(() => {
      const pendingFilter = screen.getByTestId(
        'custom-injected-filter-pending',
      );
      expect(pendingFilter.getAttribute('data-height')).toBe('$6');
      expect(pendingFilter.getAttribute('data-background-color')).toBe(
        '$bgCaution',
      );
      expect(
        within(pendingFilter)
          .getByText(/^Pending/u)
          .getAttribute('data-color'),
      ).toBe('$textCaution');
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-compound'),
      ).not.toBeNull();
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-docs-only'),
      ).not.toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-aave'),
      ).toBeNull();
    });

    fireEvent.click(screen.getByTestId('custom-injected-e2e-filter-recorded'));
    fireEvent.click(screen.getByTestId('custom-injected-e2e-filter-adapter'));

    await waitFor(() => {
      const recordedFilter = screen.getByTestId(
        'custom-injected-e2e-filter-recorded',
      );
      expect(recordedFilter.getAttribute('data-background-color')).toBe(
        '$bgInfoSubdued',
      );
      expect(
        recordedFilter
          .closest('[data-tooltip-content]')
          ?.getAttribute('data-tooltip-content'),
      ).toBe(
        "Browser interaction recording used as the source for this protocol's E2E workflow. Showing only protocols that have it. Click to require it to be missing.",
      );
      expect(
        within(recordedFilter)
          .getByText(/^\+ Recorded/u)
          .getAttribute('data-color'),
      ).toBe('$textInfo');
      expect(
        screen.getByTestId('custom-injected-protocol-custom-aave'),
      ).not.toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-compound'),
      ).toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-docs-only'),
      ).toBeNull();
      expect(
        screen.getByTestId('custom-injected-filter-panel-toggle').textContent,
      ).toBe('Filters · 4');
    });
  });

  test('cycles an E2E badge from included to excluded to unfiltered', async () => {
    render(<CustomInjectedProtocolListModal />);
    await waitForE2EStatesToLoad();
    openFilterPanel();

    const recordedFilter = screen.getByTestId(
      'custom-injected-e2e-filter-recorded',
    );
    fireEvent.click(recordedFilter);
    fireEvent.click(recordedFilter);

    await waitFor(() => {
      expect(recordedFilter.getAttribute('aria-label')).toBe(
        'Recorded: must be incomplete',
      );
      expect(recordedFilter.getAttribute('data-background-color')).toBe(
        '$bgCritical',
      );
      expect(recordedFilter.textContent).toBe('− Recorded 1');
      expect(
        recordedFilter
          .closest('[data-tooltip-content]')
          ?.getAttribute('data-tooltip-content'),
      ).toBe(
        "Browser interaction recording used as the source for this protocol's E2E workflow. Showing only protocols that do not have it. Click to stop filtering.",
      );
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-docs-only'),
      ).not.toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-aave'),
      ).toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-compound'),
      ).toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-custom-aave'),
      ).toBeNull();
    });

    fireEvent.click(recordedFilter);
    await waitFor(() => {
      expect(recordedFilter.getAttribute('aria-label')).toBe(
        'Recorded: not filtered',
      );
      expect(
        recordedFilter
          .closest('[data-tooltip-content]')
          ?.getAttribute('data-tooltip-content'),
      ).toBe(
        "Browser interaction recording used as the source for this protocol's E2E workflow. Not used as a filter. Click to require it.",
      );
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-aave'),
      ).not.toBeNull();
      expect(
        screen.getByTestId('custom-injected-protocol-custom-aave'),
      ).not.toBeNull();
    });
  });

  test('searches an exact sequence number', async () => {
    render(<CustomInjectedProtocolListModal />);
    await waitForE2EStatesToLoad();

    fireEvent.change(screen.getByTestId('custom-injected-protocol-search'), {
      target: { value: '#3' },
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-docs-only'),
      ).not.toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-compound'),
      ).toBeNull();
    });
  });

  test('keeps filters in memory across modal mounts', async () => {
    const first = render(<CustomInjectedProtocolListModal />);
    await waitForE2EStatesToLoad();
    openFilterPanel();
    fireEvent.click(screen.getByTestId('custom-injected-source-custom'));
    fireEvent.change(screen.getByTestId('custom-injected-protocol-search'), {
      target: { value: 'legacy' },
    });
    await screen.findByTestId('custom-injected-protocol-custom-aave');
    first.unmount();

    render(<CustomInjectedProtocolListModal />);

    expect(
      screen
        .getByTestId('custom-injected-protocol-search')
        .getAttribute('value'),
    ).toBe('legacy');
    expect(
      screen.getByTestId('custom-injected-protocol-custom-aave'),
    ).not.toBeNull();
    expect(
      screen.queryByTestId('custom-injected-protocol-defillama-aave'),
    ).toBeNull();
    await waitFor(() =>
      expect(
        screen
          .getByTestId('custom-injected-protocol-e2e-custom-aave')
          .querySelector('[data-icon-name="CodeBracketsOutline"]')
          ?.getAttribute('data-icon-color'),
      ).toBe('$iconCaution'),
    );
  });

  test('filters duplicate protocol IDs by source', async () => {
    render(<CustomInjectedProtocolListModal />);
    await waitForE2EStatesToLoad();
    openFilterPanel();

    fireEvent.click(screen.getByTestId('custom-injected-source-custom'));
    await waitFor(() => {
      expect(
        screen.getByTestId('custom-injected-protocol-custom-aave'),
      ).not.toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-defillama-aave'),
      ).toBeNull();
    });

    fireEvent.click(screen.getByTestId('custom-injected-source-defillama'));
    await waitFor(() => {
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-aave'),
      ).not.toBeNull();
      expect(
        screen.getByTestId('custom-injected-protocol-custom-aave'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId('custom-injected-source-custom'));
    await waitFor(() => {
      expect(
        screen.getByTestId('custom-injected-protocol-defillama-aave'),
      ).not.toBeNull();
      expect(
        screen.queryByTestId('custom-injected-protocol-custom-aave'),
      ).toBeNull();
    });
  });

  test('retries after the initial session load fails', async () => {
    mockActiveSession = undefined;
    mockGetWorkspace
      .mockRejectedValueOnce(new Error('Workspace unavailable'))
      .mockResolvedValueOnce(session);

    render(<CustomInjectedProtocolListModal />);

    fireEvent.click(await screen.findByTestId('custom-injected-retry-load'));

    await waitFor(() => {
      expect(
        screen.getByTestId('custom-injected-protocol-virtual-list'),
      ).not.toBeNull();
    });
    await waitForE2EStatesToLoad();
    expect(mockGetWorkspace).toHaveBeenCalledTimes(2);
  });

  test('resets filters, locates current, and selects a protocol', async () => {
    render(<CustomInjectedProtocolListModal />);
    await waitForE2EStatesToLoad();
    openFilterPanel();

    fireEvent.click(screen.getByTestId('custom-injected-filter-unsupported'));
    fireEvent.click(screen.getByTestId('custom-injected-locate-current'));
    await waitFor(() =>
      expect(mockScrollToIndex).toHaveBeenCalledWith({
        animated: true,
        index: 1,
        viewPosition: 0.5,
      }),
    );

    fireEvent.click(
      screen.getByTestId('custom-injected-protocol-defillama-aave'),
    );
    expect(mockRequestProtocolSelection).toHaveBeenCalledWith(
      session.protocols[0],
      session,
    );
    expect(mockPop).toHaveBeenCalledTimes(1);
  });

  test('navigates and scrolls within the filtered rows from the footer', async () => {
    render(<CustomInjectedProtocolListModal />);
    await waitForE2EStatesToLoad();
    openFilterPanel();

    const footer = screen.getByTestId('custom-injected-protocol-list-footer');
    expect(
      Array.from(footer.querySelectorAll('button')).every(
        (button) => button.textContent === '',
      ),
    ).toBe(true);
    expect(
      within(footer).getByTestId('custom-injected-locate-current'),
    ).not.toBeNull();

    expect(
      screen.getByTestId('custom-injected-filtered-position').textContent,
    ).toBe('2 / 4');
    fireEvent.click(screen.getByTestId('custom-injected-scroll-top'));
    expect(mockScrollToOffset).toHaveBeenCalledWith({
      animated: true,
      offset: 0,
    });
    fireEvent.click(screen.getByTestId('custom-injected-scroll-bottom'));
    expect(mockScrollToIndex).toHaveBeenCalledWith({
      animated: true,
      index: 3,
      viewPosition: 1,
    });

    fireEvent.click(screen.getByTestId('custom-injected-source-defillama'));
    await waitFor(() =>
      expect(
        screen.getByTestId('custom-injected-filtered-position').textContent,
      ).toBe('2 / 3'),
    );
    fireEvent.click(screen.getByTestId('custom-injected-filtered-next'));
    expect(mockRequestProtocolSelection).toHaveBeenLastCalledWith(
      session.protocols[2],
      session,
    );
    expect(mockPop).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByTestId('custom-injected-filtered-position').textContent,
      ).toBe('3 / 3'),
    );
  });
});
