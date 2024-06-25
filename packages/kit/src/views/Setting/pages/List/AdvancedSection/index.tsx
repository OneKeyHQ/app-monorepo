import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { BRIDGE_STATUS_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { Section } from '../Section';

const HardwareBridgeListItems = () => {
  const onPressBridgeStatus = useCallback(() => {
    openUrlExternal(BRIDGE_STATUS_URL);
  }, []);
  const intl = useIntl();

  return (
    <>
      <ListItem
        onPress={onPressBridgeStatus}
        icon="ApiConnectionOutline"
        title={intl.formatMessage({
          id: ETranslations.settings_hardware_bridge_status,
        })}
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

const SpendDustUTXOItem = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingSpendUTXOModal);
  }, [navigation]);
  const intl = useIntl();
  const [{ spendDustUTXO }] = useSettingsPersistAtom();
  return (
    <ListItem
      onPress={onPress}
      icon="CryptoCoinOutline"
      title={intl.formatMessage({ id: ETranslations.settings_spend_dust_utxo })}
      drillIn
    >
      <ListItem.Text
        primary={
          spendDustUTXO
            ? intl.formatMessage({ id: ETranslations.global_on })
            : intl.formatMessage({ id: ETranslations.global_off })
        }
        align="right"
      />
    </ListItem>
  );
};

export const AdvancedSection = () => {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onAccountDerivation = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingAccountDerivationModal);
  }, [navigation]);
  return (
    <Section title={intl.formatMessage({ id: ETranslations.global_advanced })}>
      <ListItem
        onPress={onAccountDerivation}
        icon="BranchesOutline"
        title={intl.formatMessage({
          id: ETranslations.settings_account_derivation_path,
        })}
        drillIn
      />
      {/* <SpendDustUTXOItem />  Hide the spendDustUTXO function; it's not ready yet. */}
      {platformEnv.isExtension || platformEnv.isWeb ? (
        <HardwareBridgeListItems />
      ) : null}
    </Section>
  );
};
