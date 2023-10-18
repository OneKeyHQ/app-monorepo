import { NewButton, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { TabRoutes } from '../Routes';

import type { TabMeParamList } from './Routes';

const TabMe = () => {
  const navigation = useAppNavigation<PageNavigationProp<TabMeParamList>>();

  return (
    <YStack>
      <NewButton
        onPress={() => {
          navigation.switchTab(TabRoutes.Me);
        }}
      >
        切换到首页
      </NewButton>
    </YStack>
  );
};

export default TabMe;
