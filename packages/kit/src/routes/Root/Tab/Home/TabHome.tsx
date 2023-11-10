import { Button, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';

import { ETabHomeRoutes } from './Routes';

import type { ITabHomeParamList } from './Routes';

const TabHome = () => {
  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();

  return (
    <YStack>
      <Button
        onPress={() => {
          navigation.push(ETabHomeRoutes.TabHomeStack1);
        }}
      >
        下一页
      </Button>
    </YStack>
  );
};

export default TabHome;
