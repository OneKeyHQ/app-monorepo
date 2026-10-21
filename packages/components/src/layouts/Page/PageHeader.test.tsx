/**
 * @jest-environment jsdom
 */

import type { PropsWithChildren, ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const mockSetOptions = jest.fn();
const mockNavigation = { setOptions: mockSetOptions };
const explicitHeaderStyle = { backgroundColor: '#191919' };
const pageScope = { hostKey: 'main', ownerKey: 'perp' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@onekeyfe/react-native-native-overlay', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ScopeContext = React.createContext<{
    hostKey?: string;
    ownerKey?: string;
  }>({});
  return {
    MockScopeContext: ScopeContext,
    useOverlayPageScope: () => React.useContext(ScopeContext),
    OverlayPageHostScope: ({
      hostKey,
      children,
    }: PropsWithChildren<{ hostKey: string }>) =>
      React.createElement(
        ScopeContext.Provider,
        { value: { hostKey } },
        children,
      ),
    OverlayPageOwnerScope: ({
      ownerKey,
      children,
    }: PropsWithChildren<{ ownerKey: string }>) => {
      const { hostKey } = React.useContext(ScopeContext);
      return React.createElement(
        ScopeContext.Provider,
        { value: { hostKey, ownerKey } },
        children,
      );
    },
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeIOS: false,
    isNative: false,
  },
}));

jest.mock('../../hocs', () => ({
  useIsOverlayPage: () => false,
}));

jest.mock('../../hooks', () => ({
  useTheme: () => ({
    text: {
      val: '#000000',
    },
  }),
}));

jest.mock('../../primitives/Button/GlassHeaderContext', () => ({
  toNoGlassHeaderItems: () => undefined,
  wrapHeaderRenderInGlass: (renderHeader: unknown) => renderHeader,
}));

jest.mock('../Navigation/Header/HeaderSearchBar', () => () => null);

const { PageHeader } = require('./PageHeader') as typeof import('./PageHeader');
const { MockScopeContext, useOverlayPageScope } = jest.requireMock<{
  MockScopeContext: import('react').Context<{
    hostKey?: string;
    ownerKey?: string;
  }>;
  useOverlayPageScope: () => { hostKey?: string; ownerKey?: string };
}>('@onekeyfe/react-native-native-overlay');

function ScopeProbe() {
  const { hostKey, ownerKey } = useOverlayPageScope();
  return <div>{`${hostKey ?? 'none'}/${ownerKey ?? 'none'}`}</div>;
}

const renderScopeProbe = () => <ScopeProbe />;
const emptyHeaderCases = [
  { empty: null, renderHeader: () => null },
  { empty: false, renderHeader: () => false },
  { empty: undefined, renderHeader: () => undefined },
] as const;

describe('PageHeader', () => {
  beforeEach(() => {
    mockSetOptions.mockClear();
    platformEnv.isNative = false;
  });

  it('preserves the navigator header style when the page does not override it', () => {
    render(<PageHeader title="Settings" />);

    expect(mockSetOptions).toHaveBeenCalledTimes(1);
    expect(mockSetOptions.mock.calls[0][0]).not.toHaveProperty('headerStyle');
  });

  it('forwards an explicit page header style', () => {
    render(<PageHeader headerStyle={explicitHeaderStyle} />);

    expect(mockSetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({ headerStyle: explicitHeaderStyle }),
    );
  });

  it('forwards an explicit header container background', () => {
    render(<PageHeader headerContainerBackgroundColor="#f9f9f9" />);

    expect(mockSetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        headerContainerBackgroundColor: '#f9f9f9',
      }),
    );
  });

  it('forces a transparent background for transparent headers', () => {
    render(<PageHeader headerTransparent />);

    expect(mockSetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        headerStyle: [{}, { backgroundColor: 'transparent' }],
      }),
    );
  });

  it.each(['headerLeft', 'headerRight', 'headerTitle'] as const)(
    'restores the source page scope for a detached %s callback',
    (slot) => {
      render(
        <MockScopeContext.Provider value={pageScope}>
          <PageHeader {...{ [slot]: renderScopeProbe }} />
        </MockScopeContext.Provider>,
      );

      const callback = mockSetOptions.mock.calls[0][0][slot] as () => ReactNode;
      render(<>{callback()}</>);
      expect(screen.getByText('main/perp')).toBeTruthy();
    },
  );

  it('keeps scoped header callbacks stable across a same-props rerender', () => {
    const view = (
      <MockScopeContext.Provider value={pageScope}>
        <PageHeader headerRight={renderScopeProbe} />
      </MockScopeContext.Provider>
    );
    const { rerender } = render(view);
    rerender(
      <MockScopeContext.Provider value={pageScope}>
        <PageHeader headerRight={renderScopeProbe} />
      </MockScopeContext.Provider>,
    );

    expect(mockSetOptions).toHaveBeenCalledTimes(1);
  });

  it.each([
    { native: true, scope: pageScope },
    { native: false, scope: { hostKey: 'main' } },
  ])(
    'keeps header callbacks unchanged with native=$native and scope=$scope',
    ({ native, scope }) => {
      platformEnv.isNative = native;
      render(
        <MockScopeContext.Provider value={scope}>
          <PageHeader headerRight={renderScopeProbe} />
        </MockScopeContext.Provider>,
      );

      expect(mockSetOptions.mock.calls[0][0].headerRight).toBe(
        renderScopeProbe,
      );
    },
  );

  it.each(emptyHeaderCases)(
    'preserves an empty scoped header result: $empty',
    ({ empty, renderHeader }) => {
      render(
        <MockScopeContext.Provider value={pageScope}>
          <PageHeader headerLeft={renderHeader} />
        </MockScopeContext.Provider>,
      );

      const callback = mockSetOptions.mock.calls[0][0]
        .headerLeft as () => ReactNode;
      expect(callback()).toBe(empty);
    },
  );
});
