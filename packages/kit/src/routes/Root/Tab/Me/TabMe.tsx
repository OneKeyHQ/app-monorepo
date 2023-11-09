import { useAtom } from 'jotai';

import { Button, Screen, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import {
  demoReadOnlyAtom,
  demoWriteOnlyAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/demo';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { ETabRoutes } from '../Routes';

import type { ITabMeParamList } from './Routes';

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
  const navigation = useAppNavigation<IPageNavigationProp<ITabMeParamList>>();

  return (
    <Screen>
      <YStack>
        <Button
          onPress={() => {
            navigation.switchTab(ETabRoutes.Home);
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
