import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Divider,
  FlatList,
  Icon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import { openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useWalletSelectorSectionData } from '../../../components/WalletSelector/hooks/useWalletSelectorSectionData';
import { WalletAvatarPro } from '../../../components/WalletSelector/WalletAvatar';
import { ListItemBase } from '../../../components/WalletSelector/WalletSelectorChildren/List/ListItem';
import { useNavigation } from '../../../hooks';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagRoutes } from '../Routes/enums';
import { Bip39DotmapUrl } from '../utils';

import type { IKeytagRoutesParams } from '../Routes/types';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ListRenderItem } from 'react-native';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const KeyTagBackUpWallet = () => {
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
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
      navigation.navigate(KeyTagRoutes.KeyTagVerifyPassword, {
        wallet,
        walletId: wallet.id,
        navigateMode: isVertical && platformEnv.isNative,
      });
    },
    [isVertical, navigation],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <Typography.Body1Strong ml={4} color="text-subdued">
        {intl.formatMessage({ id: 'form__you_have_no_wallet_yet' })}
      </Typography.Body1Strong>
    ),
    [intl],
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
                circular
                size="lg"
                wallet={item}
                devicesStatus={undefined}
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
          <Button
            mt={3}
            type="plain"
            ml="-16px"
            justifyContent="flex-start"
            textProps={{
              textDecorationLine: 'underline',
            }}
            onPress={() => {
              openUrlExternal(Bip39DotmapUrl);
            }}
          >
            {Bip39DotmapUrl}
          </Button>
        </Box>
      }
    >
      <FlatList
        ml={-4}
        data={walletsData}
        renderItem={renderItem}
        ListEmptyComponent={ListEmptyComponent}
      />
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
