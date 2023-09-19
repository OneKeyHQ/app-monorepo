import type { FC } from 'react';
import { memo, useCallback, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  ScrollView,
  Switch,
  Text,
  VStack,
  useTheme,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../hooks';
import { setAdvancedSettings } from '../../store/reducers/settings';

import type { HomeRoutes } from '../../routes/routesEnum';
import type { HomeRoutesParams } from '../../routes/types';
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
  const { themeVariant } = useTheme();
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
    <ScrollView
      w="full"
      h="full"
      bg="background-default"
      maxW={768}
      mx="auto"
      p={4}
    >
      <VStack space={3}>
        <Text typography="Subheading" color="text-subdued">
          BITCOIN, LITECOIN, BITCOIN CASH, DOGECOIN
        </Text>
        <VStack
          space={5}
          bg="surface-default"
          borderRadius="12"
          p={4}
          borderWidth={themeVariant === 'light' ? 1 : undefined}
          borderColor="border-subdued"
        >
          <SettingItem
            title={intl.formatMessage({ id: 'form__spend_dust_utxo' })}
            description={intl.formatMessage({
              id: 'content__after_enable_use_btc_utxo_will_increase_tx_fee_and_reduce_anonymity_and_privacy_its_recommend_to_disable_dust_utxo',
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
