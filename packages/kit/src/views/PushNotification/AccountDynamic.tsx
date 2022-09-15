import React, {
  FC,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Account as AccountComponent,
  Box,
  ScrollView,
  Spinner,
  Switch,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import { AccountDynamicItem } from '@onekeyhq/engine/src/managers/notification';
import { Account } from '@onekeyhq/engine/src/types/account';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import { useNavigation } from '@onekeyhq/kit/src/hooks';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import WalletAvatar from '../../components/Header/WalletAvatar';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';

import { ListEmptyComponent } from './Empty';
import { WalletData, useEnabledAccountDynamicAccounts } from './hooks';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsWebviewScreen
>;

const Item: FC<{
  account: Account;
  icon: string | JSX.Element;
  checked: boolean;
  onChange: (checked: boolean) => Promise<void>;
  divider: boolean;
}> = ({ divider, account, onChange, checked, icon }) => {
  const [loading, setLoading] = useState(false);

  const handleChange = (value: boolean) => {
    setLoading(true);
    onChange(value).finally(() =>
      setTimeout(() => {
        setLoading(false);
      }, 200),
    );
  };

  return (
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
        {icon}
        <Box ml="3">
          <AccountComponent
            hiddenAvatar
            address={account?.displayAddress ?? account?.address ?? ''}
            name={account.name}
          />
        </Box>
      </Box>
      {loading ? (
        <Spinner />
      ) : (
        <Switch
          labelType="false"
          isChecked={checked}
          onToggle={() => handleChange(!checked)}
        />
      )}
    </Box>
  );
};

const Section: FC<
  WalletData & {
    refreash: () => Promise<void>;
    enabledAccounts: AccountDynamicItem[];
  }
> = ({ name, type, accounts, avatar, enabledAccounts, refreash }) => {
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const { serviceNotification } = backgroundApiProxy;

  const handleChange = useCallback(
    async (account: Account, checked: boolean) => {
      if (checked) {
        await serviceNotification.addAccountDynamic({
          accountId: account.id,
          address: account.address,
          name: account.name,
        });
      } else {
        await serviceNotification.removeAccountDynamic({
          address: account.address,
        });
      }
      await refreash();
    },
    [serviceNotification, refreash],
  );

  const { length } = accounts;

  const icon = useMemo(() => {
    if (
      [
        WALLET_TYPE_IMPORTED,
        WALLET_TYPE_WATCHING,
        WALLET_TYPE_EXTERNAL,
      ].includes(type)
    ) {
      return (
        <WalletAvatar
          size="sm"
          avatarBgColor="surface-neutral-default"
          walletImage={type}
          circular
        />
      );
    }
    return (
      <Box
        bg={avatar?.bgColor || '#000'}
        w="8"
        h="8"
        borderRadius="50"
        justifyContent="center"
        alignItems="center"
      >
        {avatar?.emoji}
      </Box>
    );
  }, [type, avatar]);

  const walletName = useMemo(() => {
    switch (type) {
      case WALLET_TYPE_IMPORTED:
        return intl.formatMessage({ id: 'wallet__imported_accounts' });
      case WALLET_TYPE_WATCHING:
        return intl.formatMessage({ id: 'wallet__watched_accounts' });
      case WALLET_TYPE_EXTERNAL:
        return intl.formatMessage({ id: 'content__external_account' });
      default:
        break;
    }
    return name;
  }, [type, name, intl]);

  return (
    <>
      <Typography.Subheading>{walletName}</Typography.Subheading>
      <Box
        w="full"
        mt="2"
        mb={6}
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {accounts.map((a, index) => (
          <Item
            key={a.id}
            icon={icon}
            account={a}
            checked={
              !!enabledAccounts.find((account) => account.address === a.address)
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
  const { wallets, enabledAccounts, refresh, loading } =
    useEnabledAccountDynamicAccounts();
  const navigation = useNavigation<NavigationProps>();

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'title__manage_account_dynamic' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  if (!wallets.length) {
    return (
      <ListEmptyComponent
        isLoading={loading}
        desc={intl.formatMessage({
          id: 'content__there_are_no_accounts_available_for_subscriptions',
        })}
      />
    );
  }

  return (
    <ScrollView
      w="full"
      h="full"
      bg="background-default"
      p="4"
      maxW={768}
      mx="auto"
    >
      {wallets
        .map((w) => ({
          ...w,
          accounts: w.accounts.filter((a) =>
            isCoinTypeCompatibleWithImpl(a.coinType, IMPL_EVM),
          ),
        }))
        .filter((w) => !!w.accounts.length)
        .map((wallet) => (
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
