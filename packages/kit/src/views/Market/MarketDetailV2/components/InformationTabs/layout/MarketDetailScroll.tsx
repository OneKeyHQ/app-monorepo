import { Tabs } from '@onekeyhq/components';
import { useFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';
import { useAppPager } from '@onekeyhq/kit/src/components/AppPager/context';

export const MarketDetailScrollView = Tabs.ScrollView;
export const MarketDetailList = Tabs.FlatList;
export { HeaderScrollGestureWrapper as MarketDetailHeaderGesture } from '@onekeyhq/components';
export {
  useIsFocusedTab as useMarketDetailIsFocusedTab,
  useCurrentTabScrollY as useMarketDetailScrollY,
} from '@onekeyhq/components/src/composite/Tabs/hooks';
export function useMarketDetailFocusedTab() {
  const { focusedName } = useAppPager();
  const legacy = useFocusedTab();
  return focusedName || legacy;
}
