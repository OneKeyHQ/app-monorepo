import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { openUrlExternal } from '../../../utils/openUrl';

import { Section } from './Section';

import type { IModalSettingParamList } from '../types';

export const HardwareBridgeSection = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPressBridgeSdkUrl = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingHardwareSdkUrlModal,
    });
  }, [navigation]);

  const onPressBridgeStatus = useCallback(() => {
    openUrlExternal('http://127.0.0.1:21320/status/');
  }, []);
  const intl = useIntl();

  const showBridgePortSetting = useMemo<boolean>(
    () => !!(platformEnv.isExtension || platformEnv.isWeb),
    [],
  );

  const [settings] = useSettingsPersistAtom();

  if (!showBridgePortSetting) {
    return null;
  }

  return (
    <Section title="HARDWARE BRIDGE">
      <ListItem
        onPress={onPressBridgeSdkUrl}
        icon="CodeOutline"
        title={intl.formatMessage({ id: 'form__hardware_bridge_sdk_url' })}
        drillIn
      >
        <ListItem.Text
          primary={settings.hardwareConnectSrc}
          align="right"
          primaryTextProps={{
            tone: 'subdued',
          }}
        />
      </ListItem>
      <ListItem
        onPress={onPressBridgeStatus}
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
