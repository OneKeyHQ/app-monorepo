import type { ISearchBarProps } from '@onekeyhq/components';
import { SearchBar } from '@onekeyhq/components';

export function MarketHomeHeaderSearchBar({
  size,
}: {
  size?: ISearchBarProps['size'];
}) {
  return (
    <SearchBar
      placeholder="Search symbol, contract address"
      containerProps={{ w: '100%' }}
      size={size}
      key="MarketHomeSearchInput"
    />
  );
}
