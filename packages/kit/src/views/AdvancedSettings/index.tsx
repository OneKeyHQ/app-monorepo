import type { FC } from 'react';
import { memo, useCallback, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import { HStack, ScrollView, Switch, Text, VStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../hooks';
import { setAdvancedSettings } from '../../store/reducers/settings';

import type { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.AdvancedSettings
>;

const SettingItem: FC<{
  title: string;
  description: string;
  isChecked: boolean;
  onChange: () => void;
}> = ({ title, description, isChecked, onChange }) => (
  <VStack space={3}>
    <HStack alignItems="center" justifyContent="space-between">
      <Text typography="Body1Strong">{title}</Text>
      <Switch labelType="false" isChecked={isChecked} onToggle={onChange} />
    </HStack>
    <Text typography="Caption">{description}</Text>
  </VStack>
);
function AdvancedSettings() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const useDustUtxo =
    useAppSelector((s) => s.settings.advancedSettings?.useDustUtxo) ?? true;
  const setUseDustUtxoSetting = useCallback(() => {
    backgroundApiProxy.dispatch(
      setAdvancedSettings({
        useDustUtxo: !useDustUtxo,
      }),
    );
  }, [useDustUtxo]);

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'form__advanced' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  return (
    <ScrollView p={4}>
      <VStack space={3}>
        <Text typography="Subheading" color="text-subdued">
          BITCOIN
        </Text>
        <VStack space={5}>
          <SettingItem
            title={intl.formatMessage({ id: 'form__use_dust_utxo' })}
            description={intl.formatMessage({
              id: 'content__after_enable_btc_child_addr_addr_changes_every_time_after_receive_tx_and_change_addr_are_auto_used_when_send_btx_tx',
            })}
            isChecked={useDustUtxo}
            onChange={setUseDustUtxoSetting}
          />
        </VStack>
      </VStack>
    </ScrollView>
  );
}

export default memo(AdvancedSettings);
