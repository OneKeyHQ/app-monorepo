import { Button, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';

import { TabHomeRoutes } from './Routes';

import type { TabHomeParamList } from './Routes';

const TabHome = () => {
  const navigation = useAppNavigation<IPageNavigationProp<TabHomeParamList>>();

  return (
    <YStack>
      <Button
        onPress={() => {
          navigation.push(TabHomeRoutes.TabHomeStack1);
        }}
      >
        下一页
      </Button>
    </YStack>
  );
};

export default TabHome;
