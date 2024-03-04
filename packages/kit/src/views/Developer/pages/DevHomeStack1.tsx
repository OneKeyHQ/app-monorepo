import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import type {
  IPageNavigationProp,
  IPageScreenProps,
} from '@onekeyhq/components/src/layouts/Navigation';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ETabDeveloperRoutes, type ITabDeveloperParamList } from '../type';

const DevHomeStack1 = (
  props: IPageScreenProps<
    ITabDeveloperParamList,
    ETabDeveloperRoutes.DevHomeStack1
  >,
) => {
  const { route } = props;
  console.log(route.params.a, route.params.b);
  const navigation =
    useAppNavigation<
      IPageNavigationProp<
        ITabDeveloperParamList,
        ETabDeveloperRoutes.DevHomeStack1
      >
    >();
  return (
    <Page>
      <SizableText>{`a: ${route.params.a}, b:${route.params.b}`}</SizableText>
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
            navigation.push(ETabDeveloperRoutes.DevHomeStack2);
          }}
        >
          下一页
        </Button>
      </YStack>
    </Page>
  );
};

export default DevHomeStack1;
