import { Button, Page, YStack } from '@onekeyhq/components';
import type {
  IPageNavigationProp,
  IPageScreenProps,
} from '@onekeyhq/components/src/layouts/Navigation';

import useAppNavigation from '../../../hooks/useAppNavigation';

import { ETabHomeRoutes } from './Routes';

import type { ITabHomeParamList } from './Routes';

const TabHomeStack1 = (
  props: IPageScreenProps<ITabHomeParamList, ETabHomeRoutes.TabHomeStack1>,
) => {
  const { route } = props;
  console.log(route.params.a, route.params.b);
  const navigation =
    useAppNavigation<
      IPageNavigationProp<ITabHomeParamList, ETabHomeRoutes.TabHomeStack1>
    >();
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
            navigation.push(ETabHomeRoutes.TabHomeStack2);
          }}
        >
          下一页
        </Button>
      </YStack>
    </Page>
  );
};

export default TabHomeStack1;
