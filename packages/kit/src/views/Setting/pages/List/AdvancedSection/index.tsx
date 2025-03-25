import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Select, XStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Section } from '@onekeyhq/kit/src/components/Section';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { BRIDGE_STATUS_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

const HardwareBridgeListItems = () => {
  const [{ hardwareTransportType }] = useSettingsPersistAtom();
  const onPressBridgeStatus = useCallback(() => {
    openUrlExternal(BRIDGE_STATUS_URL);
  }, []);
  const intl = useIntl();

  if (hardwareTransportType !== EHardwareTransportType.Bridge) {
    return null;
  }

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

const HardwareTransportTypeListItem = () => {
  const intl = useIntl();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();

  const transportOptions = useMemo(() => {
    if (platformEnv.isNative) {
      return [
        {
          label: 'Bluetooth',
          value: EHardwareTransportType.BLE,
        },
      ];
    }
    if (platformEnv.isDesktop) {
      return [
        {
          label: 'Bridge',
          value: EHardwareTransportType.Bridge,
        },
      ];
    }
    if (platformEnv.isWeb || platformEnv.isExtension) {
      return [
        {
          label: 'WebUSB',
          value: EHardwareTransportType.WEBUSB,
          iconProps: { name: 'UsbOutline' as const },
        },
        {
          label: 'Bridge',
          value: EHardwareTransportType.Bridge,
        },
      ];
    }
    return [];
  }, []);
  const onChange = useCallback(async (value: string) => {
    if (platformEnv.isWeb || platformEnv.isExtension) {
      await backgroundApiProxy.serviceHardware.switchTransport({
        transportType: value as EHardwareTransportType,
      });
    }
    await backgroundApiProxy.serviceSetting.setHardwareTransportType(
      value as EHardwareTransportType,
    );
  }, []);

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({
        id: ETranslations.device_hardware_communication,
      })}
      items={transportOptions}
      value={hardwareTransportType}
      onChange={onChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <ListItem
          userSelect="none"
          icon="UsbOutline"
          title={intl.formatMessage({
            id: ETranslations.device_hardware_communication,
          })}
        >
          <XStack>
            <ListItem.Text primary={label} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
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

  const onCustomRPC = useCallback(() => {
    defaultLogger.setting.page.enterCustomRPC();
    navigation.push(EModalSettingRoutes.SettingCustomRPC);
  }, [navigation]);

  const onAddCustomNetwork = useCallback(() => {
    defaultLogger.setting.page.enterCustomRPC();
    navigation.push(EModalSettingRoutes.SettingCustomNetwork);
  }, [navigation]);
  const onAlignPrimaryAccount = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingAlignPrimaryAccount);
  }, [navigation]);

  const onCustomizeTransaction = useCallback(() => {
    defaultLogger.setting.page.enterCustomizeTransaction();
    navigation.push(EModalSettingRoutes.SettingCustomTransaction);
  }, [navigation]);

  return (
    <Section title={intl.formatMessage({ id: ETranslations.global_advanced })}>
      {platformEnv.isWeb ? null : (
        <ListItem
          onPress={onAlignPrimaryAccount}
          icon="RefreshCcwOutline"
          title={intl.formatMessage({
            id: ETranslations.settings_account_sync_modal_title,
          })}
          drillIn
        />
      )}

      <ListItem
        onPress={onAddCustomNetwork}
        icon="GlobusOutline"
        title={intl.formatMessage({
          id: ETranslations.custom_network_add_network_action_text,
        })}
        drillIn
      />
      <ListItem
        onPress={onCustomRPC}
        icon="BezierNodesOutline"
        title={intl.formatMessage({ id: ETranslations.custom_rpc_title })}
        drillIn
      />
      <ListItem
        onPress={onAccountDerivation}
        icon="BranchesOutline"
        title={intl.formatMessage({
          id: ETranslations.settings_account_derivation_path,
        })}
        drillIn
      />
      <ListItem
        onPress={onCustomizeTransaction}
        icon="LabOutline"
        title={intl.formatMessage({
          id: ETranslations.global_customize_transaction,
        })}
        drillIn
      />
      {/* <SpendDustUTXOItem />  Hide the spendDustUTXO function; it's not ready yet. */}
      {platformEnv.isExtension || platformEnv.isWeb ? (
        <HardwareTransportTypeListItem />
      ) : null}
      {platformEnv.isExtension || platformEnv.isWeb ? (
        <HardwareBridgeListItems />
      ) : null}
    </Section>
  );
};
