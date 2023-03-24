import { useCallback, useEffect, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Modal,
  Pressable,
  SectionList,
  Typography,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import WalletAvatar from '../../../components/WalletSelector/WalletAvatar';
import { useRuntime } from '../../../hooks/redux';

import type { SwapRoutes, SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';
import type { SectionListRenderItem } from 'react-native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.PickAccount>;

type WalletAccount = {
  wallet: Wallet;
  data: Account[];
};

const MyWallet = () => {
  const { wallets } = useRuntime();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networkId, onSelected } = route.params ?? {};
  const [sections, setSections] = useState<WalletAccount[]>([]);
  useEffect(() => {
    // TODO make it a hook and use promise.all (same logic in pickaddress)
    async function main() {
      for (let i = 0; i < wallets.length; i += 1) {
        const wallet = wallets[i];
        if (wallet.type !== 'watching') {
          const accounts = await backgroundApiProxy.engine.getAccounts(
            wallet.accounts,
            networkId,
          );
          if (accounts && accounts.length > 0) {
            setSections((prev) => [
              ...prev,
              { wallet, data: accounts, key: wallet.id },
            ]);
          }
        }
      }
    }
    main();
    // eslint-disable-next-line
  }, []);

  const onPress = useCallback(
    (account: Account) => {
      onSelected?.(account);
      navigation.goBack();
    },
    [onSelected, navigation],
  );

  const renderItem: SectionListRenderItem<Account, WalletAccount> = ({
    item,
    section,
    index,
  }) => (
    <Pressable
      flexDirection="row"
      p="4"
      mx={{ base: 4, md: 6 }}
      borderTopLeftRadius={index === 0 ? '12' : undefined}
      borderTopRightRadius={index === 0 ? '12' : undefined}
      borderBottomLeftRadius={
        index === section.data.length - 1 ? '12' : undefined
      }
      borderBottomRightRadius={
        index === section.data.length - 1 ? '12' : undefined
      }
      borderBottomWidth={index === section.data.length - 1 ? 1 : 0}
      borderWidth={1}
      borderColor="divider"
      onPress={() => onPress(item)}
      alignItems="center"
    >
      <Box mr="3" key={item.address}>
        <WalletAvatar
          avatar={section.wallet.avatar}
          walletImage={section.wallet.type}
          hwWalletType={
            (section.wallet.deviceType as IOneKeyDeviceType) ||
            getDeviceTypeByDeviceId(section.wallet.associatedDevice)
          }
          size="sm"
        />
      </Box>
      <Box flex="1">
        <Typography.Body1Strong color="text-default" numberOfLines={1}>
          {item.name}
        </Typography.Body1Strong>
        <Typography.Body2 color="text-subdued">
          {shortenAddress(item.address)}
        </Typography.Body2>
      </Box>
    </Pressable>
  );
  return (
    <SectionList
      stickySectionHeadersEnabled={false}
      sections={sections}
      keyExtractor={(item: Account, index) => `${item.address}${index}`}
      renderItem={renderItem}
      // eslint-disable-next-line
      renderSectionHeader={({ section }: { section: WalletAccount }) => (
        <Typography.Subheading
          my="2"
          mx={{ base: 4, md: 6 }}
          color="text-subdued"
        >
          {section.wallet.name}
        </Typography.Subheading>
      )}
    />
  );
};

const PickAccount = () => {
  const intl = useIntl();
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__choose_an_account' })}
      footer={null}
      primaryActionTranslationId="form__enter_address"
      hideSecondaryAction
      hidePrimaryAction
      maxHeight="560px"
      staticChildrenProps={{ flex: 1, py: 6 }}
    >
      <MyWallet />
    </Modal>
  );
};

export default PickAccount;
