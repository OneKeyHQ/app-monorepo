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
import { setDappModeSettings } from '../../store/reducers/settings';

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
function DappModeSettings() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();
  const useDappMode =
    useAppSelector((s) => s.settings.dappModeSettings?.useDappMode) ?? true;
  const setUseDappModeSetting = useCallback(() => {
    backgroundApiProxy.dispatch(
      setDappModeSettings({
        useDappMode: !useDappMode,
      }),
    );
  }, [useDappMode]);

  useLayoutEffect(() => {
    const title = 'Dapp Mode Setting';
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
          Dapp Mode Switch
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
            title='Enable Dapp Mode'
            description='Enable Dapp Mode to connect extension wallets like MetaMask directly, start to use Swap and other Dapps.'
            isChecked={useDappMode}
            onChange={setUseDappModeSetting}
          />
        </VStack>
      </VStack>
    </ScrollView>
  );
}

export default memo(DappModeSettings);
