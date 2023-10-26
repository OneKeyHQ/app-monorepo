import { Button, Screen, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { TabRoutes } from '../Routes';

import type { TabMeParamList } from './Routes';

const TabMe = () => {
  const navigation = useAppNavigation<PageNavigationProp<TabMeParamList>>();

  return (
    <Screen>
      <YStack>
      <Button
        onPress={() => {
          navigation.switchTab(TabRoutes.Me);
        }}
      >
        <Button>切换到首页</Button>
      </Button>
    </YStack>
    </Screen>
  );
};

export default TabMe;
