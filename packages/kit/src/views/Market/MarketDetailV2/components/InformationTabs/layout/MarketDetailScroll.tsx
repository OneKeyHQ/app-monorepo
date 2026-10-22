import { Tabs } from '@onekeyhq/components';

export const MarketDetailScrollView = Tabs.ScrollView;
export const MarketDetailList = Tabs.FlatList;
export { HeaderScrollGestureWrapper as MarketDetailHeaderGesture } from '@onekeyhq/components';
export {
  useIsFocusedTab as useMarketDetailIsFocusedTab,
  useCurrentTabScrollY as useMarketDetailScrollY,
} from '@onekeyhq/components/src/composite/Tabs/hooks';
export { useFocusedTab as useMarketDetailFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';
