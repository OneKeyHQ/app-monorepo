import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/router/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { BRIDGE_STATUS_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { Section } from '../Section';

import type { IModalSettingParamList } from '../../../router/types';

const HardwareBridgeListItems = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPressBridgeSdkUrl = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingHardwareSdkUrlModal,
    });
  }, [navigation]);

  const onPressBridgeStatus = useCallback(() => {
    openUrlExternal(BRIDGE_STATUS_URL);
  }, []);
  const intl = useIntl();

  const [settings] = useSettingsPersistAtom();

  return (
    <>
      <ListItem
        onPress={onPressBridgeSdkUrl}
        icon="CodeOutline"
        title={intl.formatMessage({ id: 'form__hardware_bridge_sdk_url' })}
        drillIn
      >
        <ListItem.Text primary={settings.hardwareConnectSrc} align="right" />
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
    </>
  );
};

export const AdvancedSection = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingSpendUTXOModal,
    });
  }, [navigation]);
  const onAccountDerivation = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingAccountDerivationModal,
    });
  }, [navigation]);
  const intl = useIntl();
  const [{ spendDustUTXO }] = useSettingsPersistAtom();
  return (
    <Section title="Advanced">
      <ListItem
        onPress={onAccountDerivation}
        icon="AlbumsOutline"
        title="Account Derivation Path"
        drillIn
      />
      <ListItem
        onPress={onPress}
        icon="CryptoCoinOutline"
        title={intl.formatMessage({ id: 'form__spend_dust_utxo' })}
        drillIn
      >
        <ListItem.Text primary={spendDustUTXO ? 'On' : 'Off'} align="right" />
      </ListItem>

      {platformEnv.isExtension || platformEnv.isWeb ? (
        <HardwareBridgeListItems />
      ) : null}
    </Section>
  );
};
