import { Button, Page, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ETabDeveloperRoutes, type ITabDeveloperParamList } from '../type';

const DevHomeStack2 = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabDeveloperParamList>>();

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
            navigation.navigate(ETabDeveloperRoutes.DevHome);
          }}
        >
          回首页
        </Button>
      </YStack>
    </Page>
  );
};

export default DevHomeStack2;
