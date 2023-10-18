import { Button, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';

import { TabHomeRoutes } from './Routes';

import type { TabHomeParamList } from './Routes';

const TabHomeStack2 = () => {
  const navigation = useAppNavigation<PageNavigationProp<TabHomeParamList>>();

  return (
    <YStack>
      <Button
        onPress={() => {
          navigation.pop();
        }}
      >
        上一页
      </Button>
      <Button
        onPress={() => {
          navigation.push(TabHomeRoutes.TabHome);
        }}
      >
        回首页
      </Button>
    </YStack>
  );
};

export default TabHomeStack2;
