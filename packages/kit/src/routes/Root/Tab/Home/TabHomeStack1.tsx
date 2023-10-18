import { NewButton, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';

import { TabHomeRoutes } from './Routes';

import type { TabHomeParamList } from './Routes';

const TabHomeStack1 = () => {
  const navigation = useAppNavigation<PageNavigationProp<TabHomeParamList>>();

  return (
    <YStack>
      <NewButton
        onPress={() => {
          navigation.pop();
        }}
      >
        上一页
      </NewButton>
      <NewButton
        onPress={() => {
          navigation.push(TabHomeRoutes.TabHomeStack2);
        }}
      >
        下一页
      </NewButton>
    </YStack>
  );
};

export default TabHomeStack1;
