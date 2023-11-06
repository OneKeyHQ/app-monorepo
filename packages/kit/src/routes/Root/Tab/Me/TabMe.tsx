import { useAtom } from 'jotai';

import { Button, Screen, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';
import {
  demoReadOnlyAtom,
  demoWriteOnlyAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/demo';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { TabRoutes } from '../Routes';

import type { TabMeParamList } from './Routes';

function MeJotaiDemo() {
  const [b] = useAtom(demoReadOnlyAtom());
  const [, w] = useAtom(demoWriteOnlyAtom());
  return (
    <Button
      onPress={() => {
        console.log('1');
        w({ discount: 0.1 });
      }}
    >
      hello: {b}
    </Button>
  );
}

const TabMe = () => {
  const navigation = useAppNavigation<PageNavigationProp<TabMeParamList>>();

  return (
    <Screen>
      <YStack>
        <Button
          onPress={() => {
            navigation.switchTab(TabRoutes.Home);
          }}
        >
          切换到首页
        </Button>
        <MeJotaiDemo />
      </YStack>
    </Screen>
  );
};

export default TabMe;
