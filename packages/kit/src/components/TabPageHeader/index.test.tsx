/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { TabPageHeader } from '.';

import { render } from '@testing-library/react';

import { Page } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

type IHeaderOptions = {
  headerContainerBackgroundColor?: string;
  headerStyle?: { backgroundColor?: string };
};

let mockOptions: IHeaderOptions = {};
let mockBackground = '#f8f8f8';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Page: {
      Header: (options: IHeaderOptions) => {
        React.useLayoutEffect(() => {
          // Navigation merges new options into the current route's options.
          mockOptions = { ...mockOptions, ...options };
        }, [options]);
        return null;
      },
    },
    XStack: ({ children }: { children?: ReactNode }) => children,
    useMedia: () => ({ md: false }),
    useTheme: () => ({ bgSubdued: { val: mockBackground } }),
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../states/jotai/contexts/accountSelector', () => ({}));
jest.mock('../../views/Discovery/pages/components/HistoryIconButton', () => ({
  HistoryIconButton: () => null,
}));
jest.mock('./UniversalSearchInput', () => ({
  UniversalSearchInput: () => null,
}));
jest.mock('./components', () => ({
  GiftAction: () => null,
  HeaderUpdateButton: () => null,
  WalletConnectionForWeb: () => null,
  WalletConnectionGroup: () => null,
}));
jest.mock('./components/HeaderNotificationIconButton', () => ({
  HeaderNotificationIconButton: () => null,
}));
jest.mock('./DappHeader', () => ({ DappHeader: () => null }));
jest.mock('./HeaderLeft', () => ({
  HeaderLeft: () => null,
  DiscoveryHeaderSegment: () => null,
}));
jest.mock('./MDHeader', () => ({ MDHeader: () => null }));
jest.mock('./urlAccountPageHeader', () => ({
  UrlAccountPageHeader: () => null,
}));

describe('desktop tab header background', () => {
  it.each(['#f8f8f8', '#191919'])(
    'replaces the compact referral background with %s across the whole bar',
    (background) => {
      mockOptions = {};
      mockBackground = background;
      const { rerender } = render(
        <Page.Header
          headerContainerBackgroundColor="#ffffff"
          headerStyle={{ backgroundColor: '#ffffff' }}
        />,
      );

      expect(mockOptions.headerContainerBackgroundColor).toBe('#ffffff');

      rerender(
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
        />,
      );

      expect(mockOptions.headerStyle?.backgroundColor).toBe(background);
      expect(mockOptions.headerContainerBackgroundColor).toBe(background);
    },
  );
});
