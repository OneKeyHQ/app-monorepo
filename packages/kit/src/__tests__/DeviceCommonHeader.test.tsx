/** @jest-environment jsdom */

import type { ReactNode } from 'react';
import { createElement as renderElement, useMemo, useState } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { EPageType } from '../../../components/src/hocs/PageType';
import { PageTypeContext } from '../../../components/src/hocs/PageType/context';
import HeaderBackButton from '../../../components/src/layouts/Navigation/Header/HeaderBackButton';
import { DeviceCommonHeader } from '../views/DeviceManagement/pages/DeviceCommonHeader';

import type { IPageHeaderProps } from '../../../components/src/layouts/Page/PageHeader';

let mockWidth = 767;
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn<void, [IPageHeaderProps]>();
const mockNavigation = { setOptions: mockSetOptions };
const outerPageType = { pageType: EPageType.fullScreenPush };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: false, isDesktop: false },
}));
jest.mock('../../../components/src/hocs', () =>
  jest.requireActual<typeof import('../../../components/src/hocs/PageType')>(
    '../../../components/src/hocs/PageType',
  ),
);
jest.mock('../../../components/src/hooks', () => ({
  useTheme: () => ({ text: { val: '#000000' } }),
}));
jest.mock(
  '../../../components/src/primitives/Button/GlassHeaderContext',
  () => ({
    toNoGlassHeaderItems: () => undefined,
    wrapHeaderRenderInGlass: (header: unknown) => header,
  }),
);
jest.mock(
  '../../../components/src/layouts/Navigation/Header/HeaderSearchBar',
  () => () => null,
);
jest.mock(
  '../../../components/src/layouts/Navigation/Header/HeaderButtonGroup',
  () =>
    ({ children }: { children?: ReactNode }) =>
      children,
);
jest.mock(
  '../../../components/src/layouts/Navigation/Header/HeaderIconButton',
  () => {
    const { createElement } =
      jest.requireActual<typeof import('react')>('react');
    return ({ testID, onPress }: { testID: string; onPress?: () => void }) =>
      createElement('button', { 'data-testid': testID, onClick: onPress });
  },
);
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const page = jest.requireActual<
    typeof import('../../../components/src/layouts/Page/PageHeader')
  >('../../../components/src/layouts/Page/PageHeader');
  const pageType = jest.requireActual<
    typeof import('../../../components/src/hocs/PageType')
  >('../../../components/src/hocs/PageType');
  const buttons = jest.requireActual<
    typeof import('../../../components/src/layouts/Navigation/Header/HeaderBackButton')
  >('../../../components/src/layouts/Navigation/Header/HeaderBackButton');
  return {
    Page: { Header: page.PageHeader },
    NavBackButton: buttons.NavBackButton,
    XStack: ({ children }: { children?: ReactNode }) =>
      createElement('div', null, children),
    useMedia: () => ({ gtMd: mockWidth >= 768 }),
    useIsModalPage: pageType.useIsModalPage,
  };
});
jest.mock('../views/DeviceManagement/hooks/useDeviceBackNavigation', () => ({
  useDeviceBackNavigation: () => ({ handleBackPress: mockGoBack }),
}));
jest.mock('@onekeyhq/kit/src/components/TabPageHeader', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { PageHeader: Header } = jest.requireActual<
    typeof import('../../../components/src/layouts/Page/PageHeader')
  >('../../../components/src/layouts/Page/PageHeader');
  const search = () =>
    createElement('input', { 'data-testid': 'global-search' });
  const Icon = jest.requireMock<
    typeof import('../../../components/src/layouts/Navigation/Header/HeaderIconButton').default
  >('../../../components/src/layouts/Navigation/Header/HeaderIconButton');
  const notification = () =>
    createElement(Icon, {
      icon: 'BellOutline',
      testID: 'global-notification',
    });
  return {
    TabPageHeader: () =>
      createElement(Header, { headerTitle: search, headerRight: notification }),
  };
});

// Exercise the real Page.Header option updates and the navigator-owned close/back
// selection. Only the global Tab header controls and visual primitives are stubs.
function DeviceScreen({
  title,
  pageType,
  canGoBack = false,
}: {
  title: string;
  pageType: EPageType;
  canGoBack?: boolean;
}) {
  const [options, setOptions] = useState<IPageHeaderProps>({});
  const context = useMemo(() => ({ pageType }), [pageType]);
  mockSetOptions.mockImplementation((next) => {
    setOptions((previous) => ({ ...previous, ...next }));
  });
  const titleContent =
    typeof options.headerTitle === 'function'
      ? options.headerTitle({ children: options.title ?? '' })
      : (options.headerTitle ?? options.title);

  const rightContent = options.headerRight?.({ canGoBack });

  return (
    <PageTypeContext.Provider value={outerPageType}>
      <PageTypeContext.Provider value={context}>
        <DeviceCommonHeader title={title} />
        <header data-testid="navigation-header">
          <HeaderBackButton
            isModelScreen={pageType === EPageType.modal}
            canGoBack={canGoBack}
            renderLeft={options.headerLeft}
            onPress={mockGoBack}
          />
          <div data-testid="header-title">{titleContent}</div>
          {typeof rightContent === 'function'
            ? renderElement(rightContent)
            : rightContent}
        </header>
      </PageTypeContext.Provider>
    </PageTypeContext.Provider>
  );
}

beforeEach(() => {
  mockWidth = 767;
  jest.clearAllMocks();
});

describe.each(['Device management', 'About device'])('%s header', (title) => {
  it('opens a wide modal without global controls or an extra close button', () => {
    mockWidth = 800;
    const view = render(
      <DeviceScreen title={title} pageType={EPageType.modal} />,
    );

    expect(view.queryByTestId('global-search')).toBeNull();
    expect(view.queryByTestId('global-notification')).toBeNull();
    expect(view.getByTestId('header-title').textContent).toBe('');
    expect(view.getAllByTestId('navigation-header')).toHaveLength(1);
    expect(view.getAllByTestId('nav-header-close')).toHaveLength(1);
    expect(view.queryByTestId('nav-header-back')).toBeNull();
    fireEvent.click(view.getByTestId('nav-header-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it.each([
    [767, 768, 767],
    [768, 767, 768],
    [800, 900, 800],
  ])('keeps modal controls correct across %s → %s → %s', (...widths) => {
    mockWidth = widths[0];
    const view = render(
      <DeviceScreen title={title} pageType={EPageType.modal} />,
    );
    for (const width of widths) {
      mockWidth = width;
      view.rerender(<DeviceScreen title={title} pageType={EPageType.modal} />);
      expect(view.queryByTestId('global-search')).toBeNull();
      expect(view.queryByTestId('global-notification')).toBeNull();
      expect(view.getByTestId('header-title').textContent).toBe(
        width >= 768 ? '' : title,
      );
      expect(view.getAllByTestId('nav-header-close')).toHaveLength(1);
    }
  });

  it('preserves the navigator back button inside a nested modal stack', () => {
    mockWidth = 800;
    const view = render(
      <DeviceScreen title={title} pageType={EPageType.modal} canGoBack />,
    );
    expect(view.queryByTestId('global-search')).toBeNull();
    expect(view.queryByTestId('nav-header-close')).toBeNull();
    expect(view.getAllByTestId('nav-header-back')).toHaveLength(1);
    fireEvent.click(view.getByTestId('nav-header-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('closes and reopens a fresh wide modal with an empty header', () => {
    mockWidth = 800;
    const first = render(
      <DeviceScreen title={title} pageType={EPageType.modal} />,
    );
    fireEvent.click(first.getByTestId('nav-header-close'));
    first.unmount();
    const second = render(
      <DeviceScreen title={title} pageType={EPageType.modal} />,
    );
    expect(second.queryByTestId('global-search')).toBeNull();
    expect(second.queryByTestId('global-notification')).toBeNull();
    expect(second.getByTestId('header-title').textContent).toBe('');
    expect(second.getAllByTestId('nav-header-close')).toHaveLength(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('keeps global controls on a wide ordinary device page', () => {
    mockWidth = 800;
    const view = render(
      <DeviceScreen title={title} pageType={EPageType.stack} canGoBack />,
    );
    expect(view.getByTestId('global-search')).toBeTruthy();
    expect(view.getByTestId('global-notification')).toBeTruthy();
    expect(view.queryByTestId('nav-header-close')).toBeNull();
    expect(view.getAllByTestId('nav-header-back')).toHaveLength(1);
  });

  it('keeps the existing title and navigation on a narrow ordinary page', () => {
    const view = render(
      <DeviceScreen title={title} pageType={EPageType.stack} canGoBack />,
    );
    expect(view.getByTestId('header-title').textContent).toBe(title);
    expect(view.queryByTestId('global-search')).toBeNull();
    expect(view.queryByTestId('global-notification')).toBeNull();
    expect(view.getAllByTestId('nav-header-back')).toHaveLength(1);
  });
});
