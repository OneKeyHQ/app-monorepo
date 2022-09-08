import React, { FC, useCallback, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Account as AccountComponent,
  Box,
  ScrollView,
  Switch,
  Text,
  useTheme,
} from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import { AccountDynamicItem } from '@onekeyhq/engine/src/managers/notification';
import { Account } from '@onekeyhq/engine/src/types/account';
import { useNavigation } from '@onekeyhq/kit/src/hooks';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';

import { WalletData, useEnabledAccountDynamicAccounts } from './hooks';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsWebviewScreen
>;

const Item: FC<{
  account: Account;
  avatar: WalletData['avatar'];
  checked: boolean;
  onChange: (checked: boolean) => void;
  divider: boolean;
}> = ({ divider, account, avatar, onChange, checked }) => (
  <Box
    display="flex"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    py={4}
    px={{ base: 4, md: 6 }}
    borderBottomWidth={divider ? '1 ' : undefined}
    borderBottomColor="divider"
    borderBottomRadius={divider ? undefined : '12px'}
  >
    <Box flex="1" flexDirection="row" alignItems="center">
      <Box
        bg={avatar?.bgColor || '#000'}
        w="8"
        h="8"
        borderRadius="50"
        justifyContent="center"
        alignItems="center"
        mr="3"
      >
        {avatar?.emoji || ''}
      </Box>
      <AccountComponent
        hiddenAvatar
        address={account?.displayAddress ?? account?.address ?? ''}
        name={account.name}
      />
    </Box>
    <Switch
      labelType="false"
      isChecked={checked}
      onToggle={() => onChange(!checked)}
    />
  </Box>
);

const Section: FC<
  WalletData & {
    refreash: () => void;
    enabledAccounts: AccountDynamicItem[];
  }
> = ({ name, accounts, avatar, enabledAccounts, refreash }) => {
  const { themeVariant } = useTheme();
  const { serviceNotification } = backgroundApiProxy;

  const handleChange = useCallback(
    async (account: Account, checked: boolean) => {
      if (checked) {
        await serviceNotification.addAccountDynamic({
          address: account.address,
          name: account.name,
        });
      } else {
        await serviceNotification.removeAccountDynamic({
          address: account.address,
        });
      }
      refreash();
    },
    [serviceNotification, refreash],
  );

  const { length } = accounts;

  return (
    <>
      <Text color="text-subdued">{name}</Text>
      <Box
        w="full"
        mt="2"
        mb={6}
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {accounts
          .filter((a) => isCoinTypeCompatibleWithImpl(a.coinType, IMPL_EVM))
          .map((a, index) => (
            <Item
              key={a.id}
              avatar={avatar}
              account={a}
              checked={
                !!enabledAccounts.find(
                  (account) => account.address === a.address,
                )
              }
              onChange={(checked: boolean) => handleChange(a, checked)}
              divider={index !== length - 1}
            />
          ))}
      </Box>
    </>
  );
};

const NotificationAccountDynamic = () => {
  const intl = useIntl();
  const { wallets, enabledAccounts, refresh } =
    useEnabledAccountDynamicAccounts();
  const navigation = useNavigation<NavigationProps>();

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'title__manage_account_dynamic' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  return (
    <ScrollView
      w="full"
      h="full"
      bg="background-default"
      p="4"
      maxW={768}
      mx="auto"
    >
      {wallets.map((wallet) => (
        <Section
          key={wallet.id}
          {...wallet}
          refreash={refresh}
          enabledAccounts={enabledAccounts}
        />
      ))}
    </ScrollView>
  );
};

export default NotificationAccountDynamic;
