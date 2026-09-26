import { render } from '@testing-library/react-native';

import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { HomeNativePager } from './HomeNativePager.native';

jest.mock('@onekeyhq/components', () => ({
  useTheme: () => ({ bgApp: { val: '#ffffff' } }),
}));
jest.mock('react-native-pager-view', () => ({
  CollapsiblePagerView: () => null,
}));
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  return { useSharedValue: (value: unknown) => useRef({ value }).current };
});

it('normalizes a removed selected key and does not reactivate it when restored', () => {
  const onTabChange = jest.fn();
  let focusedName = '';
  const spot = { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null };
  const nft = { id: EHomeWalletTab.NFT, name: 'NFT', component: null };
  const common = {
    initialTabName: 'NFT',
    renderHeader: () => null,
    renderTabBar: ({ focusedTab }: { focusedTab: { value: string } }) => {
      focusedName = focusedTab.value;
      return null;
    },
    onTabChange,
  };
  const { rerender } = render(
    <HomeNativePager {...common} tabs={[spot, nft]} />,
  );
  rerender(<HomeNativePager {...common} tabs={[spot]} />);
  expect(onTabChange).toHaveBeenCalledTimes(1);
  expect(onTabChange).toHaveBeenLastCalledWith({ tabName: 'Spot' });
  rerender(<HomeNativePager {...common} tabs={[spot, nft]} />);
  expect(onTabChange).toHaveBeenCalledTimes(1);
  expect(focusedName).toBe('Spot');
});
