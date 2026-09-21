/** @jest-environment jsdom */

import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketDetailHeader } from './MarketDetailHeader';

const mockPageHeader = jest.fn((_props: IPageHeaderProps) => null);
const mockBackPress = jest.fn();
let mockWindowWidth = 402;
let mockSafeArea = { left: 0, right: 0 };
let mockMd = true;
let mockCommunityRecognized = false;

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: mockWindowWidth }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    HeaderIconButton: Container,
    Icon: Container,
    InteractiveIcon: Container,
    NavBackButton: Container,
    Page: { Header: (props: IPageHeaderProps) => mockPageHeader(props) },
    SizableText: Container,
    XStack: Container,
    YStack: Container,
    glassBarItem: (element: ReactElement) => ({ type: 'custom', element }),
    useClipboard: () => ({ copyText: jest.fn() }),
    useIsOverlayPage: () => false,
    useMedia: () => ({ md: mockMd }),
    useSafeAreaInsets: () => mockSafeArea,
    useShare: () => ({ shareText: jest.fn() }),
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS26Plus: true, isNative: true },
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorTriggerHome: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/TabPageHeader', () => ({
  TabPageHeader: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => '',
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { shortenAddress: () => '0x1234...5678' },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../components/MarketStarV2', () => ({
  MarketStarV2: () => null,
  useStarV2Checked: () => ({ checked: false, onPress: jest.fn() }),
}));
jest.mock('../../../components/TokenTagsPopover', () => ({
  TokenTagsPopover: () => null,
}));
jest.mock('../../../marketUtils', () => ({ buildMarketFullUrlV2: jest.fn() }));
jest.mock('../../hooks/useMarketDetailBackNavigation', () => ({
  useMarketDetailBackNavigation: () => ({ handleBackPress: mockBackPress }),
}));
jest.mock('../../hooks/useMarketDetailDisplayData', () => ({
  useMarketDetailHeaderDisplayData: () => ({
    tokenDetail: {
      symbol: 'BNC4',
      address: '0x12345678',
      communityRecognized: mockCommunityRecognized,
    },
    networkId: 'evm--56',
    isNative: false,
  }),
}));
jest.mock('../../hooks/useMarketDetailWatchlistIdentity', () => ({
  useMarketDetailWatchlistIdentity: () => ({}),
}));
jest.mock('../TokenDetailHeader/ShareButton', () => ({
  ShareButton: () => null,
}));
jest.mock('./TabPageHeaderContainer', () => ({
  TabPageHeaderContainer: () => null,
}));

function getHeaderItems() {
  const [options] = mockPageHeader.mock.calls.at(-1) ?? [];
  if (!options) throw new OneKeyLocalError('Expected native header options');
  const items = options.unstable_headerLeftItems?.({
    tintColor: '#000',
    canGoBack: true,
  });
  const title = items?.[1];
  if (
    title?.type !== 'custom' ||
    !isValidElement<{ maxWidth: number; flex?: number }>(title.element)
  ) {
    throw new OneKeyLocalError(
      'Expected an independently sized leading title item',
    );
  }
  return { options, items, title, titleProps: title.element.props };
}

type ILayoutElementProps = {
  children?: ReactNode;
  testID?: string;
  flexShrink?: number;
  minWidth?: number;
  numberOfLines?: number;
};

function findParentByChildTestId(
  node: ReactNode,
  testID: string,
): ReactElement<ILayoutElementProps> | undefined {
  if (!isValidElement<ILayoutElementProps>(node)) return undefined;
  const children = Children.toArray(node.props.children);
  if (
    children.some(
      (child) =>
        isValidElement<ILayoutElementProps>(child) &&
        child.props.testID === testID,
    )
  ) {
    return node;
  }
  for (const child of children) {
    const parent = findParentByChildTestId(child, testID);
    if (parent) return parent;
  }
  return undefined;
}

describe('MarketDetailHeader native layout', () => {
  beforeEach(() => {
    mockPageHeader.mockClear();
    mockWindowWidth = 402;
    mockSafeArea = { left: 0, right: 0 };
    mockMd = true;
    mockCommunityRecognized = false;
    platformEnv.isNativeIOS26Plus = true;
  });

  it('reserves separate native items for the back button and identity on first mount', () => {
    render(<MarketDetailHeader />);
    const { options, items, title, titleProps } = getHeaderItems();
    expect(options.headerShown).toBe(true);
    expect(options.headerTitle).toBe('');
    expect(items).toHaveLength(2);
    expect(title.hidesSharedBackground).toBe(true);
    expect(titleProps.flex).toBeUndefined();
    const back = items?.[0];
    expect(back).toEqual(
      expect.objectContaining({
        type: 'button',
        identifier: 'market-detail-back',
        icon: { type: 'sfSymbol', name: 'chevron.backward' },
        onPress: mockBackPress,
      }),
    );
  });

  it('bounds long titles and updates the budget for window and action changes', () => {
    const view = render(<MarketDetailHeader />);
    expect(getHeaderItems().titleProps.maxWidth).toBe(186);
    mockWindowWidth = 375;
    mockSafeArea = { left: 10, right: 10 };
    view.rerender(<MarketDetailHeader />);
    expect(getHeaderItems().titleProps.maxWidth).toBe(139);
    view.rerender(<MarketDetailHeader showFavoriteButton={false} />);
    expect(getHeaderItems().titleProps.maxWidth).toBe(195);
  });

  it.each([false, true])(
    'allows the address row to shrink on narrow screens (recognized: %s)',
    (communityRecognized) => {
      mockWindowWidth = 375;
      mockCommunityRecognized = communityRecognized;
      render(<MarketDetailHeader />);
      const { title, titleProps } = getHeaderItems();
      expect(titleProps.maxWidth).toBe(159);
      const addressRow = findParentByChildTestId(title.element, 'market-icon');
      expect(addressRow?.props).toEqual(
        expect.objectContaining({ flexShrink: 1, minWidth: 0 }),
      );
      const addressText = Children.toArray(addressRow?.props.children).find(
        (child) =>
          isValidElement<ILayoutElementProps>(child) &&
          child.props.numberOfLines === 1,
      );
      expect(
        isValidElement<ILayoutElementProps>(addressText)
          ? addressText.props.flexShrink
          : undefined,
      ).toBe(1);
    },
  );

  it('does not change the legacy mobile or large-screen header paths', () => {
    platformEnv.isNativeIOS26Plus = false;
    const view = render(<MarketDetailHeader />);
    expect(mockPageHeader).not.toHaveBeenCalled();
    platformEnv.isNativeIOS26Plus = true;
    mockMd = false;
    view.rerender(<MarketDetailHeader />);
    expect(mockPageHeader).not.toHaveBeenCalled();
  });
});
