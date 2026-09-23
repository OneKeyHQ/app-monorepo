/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import { Holders } from './Holders';

const mockHoldersState = {
  holders: [] as IMarketTokenHolder[],
  isRefreshing: undefined as boolean | undefined,
  isInitialPending: true,
};

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Stack,
    SizableText: Stack,
    ListEndIndicator: Stack,
    useMedia: () => ({ gtLg: true }),
    useIsFocusedTab: () => true,
    Tabs: {
      FlatList: ({ ListEmptyComponent }: { ListEmptyComponent: ReactNode }) => (
        <>{ListEmptyComponent}</>
      ),
    },
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketHolders',
  () => ({
    useMarketHolders: () => mockHoldersState,
  }),
);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('./components/HoldersSkeleton', () => ({
  HoldersSkeleton: () => <div>holders skeleton</div>,
}));

jest.mock('./layout/HolderItemNormal/HolderItemNormal', () => ({
  HolderItemNormal: () => null,
}));

jest.mock('./layout/HolderItemSmall/HolderItemSmall', () => ({
  HolderItemSmall: () => null,
}));

it('shows a skeleton before dispatch and an empty state only after the request settles', () => {
  const { queryByText, rerender } = render(
    <Holders tokenAddress="0xa" networkId="evm--1" />,
  );
  expect(queryByText('holders skeleton')).toBeTruthy();
  expect(queryByText(ETranslations.dexmarket_details_nodata)).toBeNull();
  mockHoldersState.isInitialPending = false;
  mockHoldersState.isRefreshing = false;
  rerender(
    <Holders tokenAddress="0xa" networkId="evm--1" scrollEnabled={false} />,
  );
  expect(queryByText('holders skeleton')).toBeNull();
  expect(queryByText(ETranslations.dexmarket_details_nodata)).toBeTruthy();
});
