import { Button, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';

import { TabHomeRoutes } from './Routes';

import type { TabHomeParamList } from './Routes';

const TabHome = () => {
  const navigation = useAppNavigation<PageNavigationProp<TabHomeParamList>>();

  return (
    <YStack>
      <Button
        onPress={() => {
          navigation.push(TabHomeRoutes.TabHomeStack1);
        }}
      >
        <Button.Text>下一页</Button.Text>
      </Button>
    </YStack>
  );
};

export default TabHome;
