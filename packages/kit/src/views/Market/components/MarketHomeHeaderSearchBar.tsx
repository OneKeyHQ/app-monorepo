import { SearchBar, View } from '@onekeyhq/components';

export function MarketHomeHeaderSearchBar() {
  return (
    <View $gtMd={{ minWidth: 280 }}>
      <SearchBar
        placeholder="Search symbol, contract address"
        containerProps={{ w: '100%' }}
        $gtMd={{ size: 'small' }}
        key="MarketHomeSearchInput"
      />
    </View>
  );
}
