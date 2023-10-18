import { NewButton, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';

import { TabHomeRoutes } from './Routes';

import type { TabHomeParamList } from './Routes';

const TabHome = () => {
  const navigation = useAppNavigation<PageNavigationProp<TabHomeParamList>>();

  return (
    <YStack>
      <NewButton
        onPress={() => {
          navigation.push(TabHomeRoutes.TabHomeStack1);
        }}
      >
        下一页
      </NewButton>
    </YStack>
  );
};

export default TabHome;
