import { Button, Page, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';

import useAppNavigation from '../../../hooks/useAppNavigation';

import { ETabHomeRoutes } from './Routes';

import type { ITabHomeParamList } from './Routes';

const TabHomeStack2 = () => {
  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();

  return (
    <Page>
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
            navigation.navigate(ETabHomeRoutes.TabHome);
          }}
        >
          回首页
        </Button>
      </YStack>
    </Page>
  );
};

export default TabHomeStack2;
