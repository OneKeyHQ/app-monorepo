import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';

import { Section } from './Section';

import type { IModalSettingParamList } from '../types';

export const HardwareBridgeSection = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingHardwareSdkUrlModal,
    });
  }, [navigation]);
  const intl = useIntl();
  return (
    <Section title="HARDWARE BRIDGE">
      <ListItem
        onPress={onPress}
        icon="CodeOutline"
        title={intl.formatMessage({ id: 'form__hardware_bridge_sdk_url' })}
        drillIn
      />
      <ListItem
        onPress={onPress}
        icon="ChartTrendingOutline"
        title={intl.formatMessage({ id: 'form__hardware_bridge_status' })}
      >
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
    </Section>
  );
};
