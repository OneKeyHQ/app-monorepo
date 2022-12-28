import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  FlatList,
  Icon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useWalletSelectorSectionData } from '../../../components/WalletSelector/hooks/useWalletSelectorSectionData';
import { WalletAvatarPro } from '../../../components/WalletSelector/WalletAvatar';
import { ListItemBase } from '../../../components/WalletSelector/WalletSelectorChildren/List/ListItem';
import { useNavigation } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { KeyTagVerifyWalletRoutes } from '../../../routes/Modal/KeyTagVerifyWallet';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagRoutes } from '../Routes/enums';

import type { IKeytagRoutesParams } from '../Routes/types';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ListRenderItem } from 'react-native';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const KeyTagBackUpWallet = () => {
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const addNavigation = useAppNavigation();
  const walletsSection = useWalletSelectorSectionData();
  const walletsData: IWallet[] = useMemo(() => {
    let res: IWallet[] = [];
    if (walletsSection.length) {
      const hdWalletDatas = walletsSection.find((item) => item.type === 'hd');
      if (hdWalletDatas) {
        const hdWallets = hdWalletDatas.data
          .filter((item) => !item.isSingleton)
          .map((item) => item.wallet)
          .filter((item) => item);
        res = hdWallets.map((item) => item as IWallet);
      }
    }

    return res;
  }, [walletsSection]);

  const onPress = useCallback(
    (wallet: IWallet) => {
      addNavigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.KeyTagVerifyWallet,
        params: {
          screen: KeyTagVerifyWalletRoutes.KeyTagVerifyPassword,
          params: {
            walletId: wallet.id,
            wallet,
          },
        },
      });
    },
    [addNavigation],
  );

  const renderItem: ListRenderItem<IWallet> = useCallback(
    ({ item }) => {
      const name = item.name || 'unknown';
      return (
        <Box py={2}>
          <ListItemBase
            onPress={() => {
              onPress(item);
            }}
            leftView={
              <WalletAvatarPro
                size={platformEnv.isNative ? 'lg' : 'sm'}
                wallet={item}
                deviceStatus={undefined}
              />
            }
            rightView={<Icon name="ChevronRightMini" />}
            text={name}
          />
        </Box>
      );
    },
    [onPress],
  );
  return (
    <LayoutContainer
      title={intl.formatMessage({ id: 'title__choose_a_wallet_to_back_up' })}
      subTitle={intl.formatMessage({
        id: 'title__choose_a_wallet_to_back_up_desc',
      })}
      fullHeight
      secondaryContent={
        <Box>
          {!isVertical ? (
            <Center
              mb={6}
              size={12}
              bgColor="decorative-surface-one"
              borderRadius="9999px"
            >
              <Icon
                size={24}
                color="decorative-icon-one"
                name="TableCellsOutline"
              />
            </Center>
          ) : null}
          <Typography.Body2>
            {intl.formatMessage({
              id: 'content__you_can_also_find_the_bip39_dotmap_in_the_following_site',
            })}
          </Typography.Body2>
        </Box>
      }
    >
      <FlatList ml={-4} data={walletsData} renderItem={renderItem} />
      <Box mt={4}>
        <Divider />
        <Box ml={-4} mt={4}>
          <ListItemBase
            onPress={() => {
              navigation.navigate(KeyTagRoutes.EnterPhrase);
            }}
            text={intl.formatMessage({ id: 'form__enter_recovery_phrase' })}
            leftView={
              <Center size={12} bgColor="surface-default" borderRadius="9999px">
                <Icon
                  size={24}
                  color="decorative-icon-one"
                  name="PencilOutline"
                />
              </Center>
            }
            rightView={<Icon name="ChevronRightMini" />}
          />
        </Box>
      </Box>
    </LayoutContainer>
  );
};

export default KeyTagBackUpWallet;
