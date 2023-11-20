import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { ETabRoutes } from '../Routes';

import type { ITabMeParamList } from './Routes';

const TabMe = () => {
  const intl = useIntl();
  const navigation = useAppNavigation<IPageNavigationProp<ITabMeParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  return (
    <Page>
      <YStack>
        <Button
          onPress={() => {
            navigation.switchTab(ETabRoutes.Home);
          }}
        >
          切换到首页
        </Button>
        <Button onPress={onPress}>
          {intl.formatMessage({ id: 'title__settings' })}
        </Button>
      </YStack>
    </Page>
  );
};

export default TabMe;
