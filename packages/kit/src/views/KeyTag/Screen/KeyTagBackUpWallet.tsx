import { useCallback, useMemo } from 'react';

import { StackNavigationProp } from '@react-navigation/stack';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  Icon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { IWallet } from '@onekeyhq/engine/src/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useWalletSelectorSectionData } from '../../../components/WalletSelector/hooks/useWalletSelectorSectionData';
import { WalletAvatarPro } from '../../../components/WalletSelector/WalletAvatar';
import { IWalletDataBase } from '../../../components/WalletSelector/WalletSelectorChildren/List';
import { ListItemBase } from '../../../components/WalletSelector/WalletSelectorChildren/List/ListItem';
import { useNavigation } from '../../../hooks';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const KeyTagBackUpWallet = () => {
  console.log('KeyTagBackUpWallet---');
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const walletsSection = useWalletSelectorSectionData();
  console.log('walletsSection', walletsSection);
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
  console.log('walletsData---', walletsData);

  const onPress = useCallback(
    (wallet: IWallet) => {
      console.log('onpress--wallet', wallet);
      navigation.navigate(KeyTagRoutes.VerifyPassword, { walletId: wallet.id });
      // navigation.navigate(KeyTagRoutes.ShowDotMap);
    },
    [navigation],
  );

  const renderItem: ListRenderItem<IWallet> = useCallback(
    ({ item }) => {
      const name = item.name || 'unknown';
      return (
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
          rightView={<Icon name="ArrowRightCircleOutline" />}
          text={name}
        />
      );
    },
    [onPress],
  );
  return (
    <LayoutContainer
      title="Choose a Wallet to Back Up"
      subTitle="Convert wallet recovery phrase into dot map for OneKey KeyTag."
      fullHeight
      secondaryContent={
        <Box>
          {!isVertical ? <Icon name="TableCellsOutline" /> : null}
          <Typography.Body2>
            You can also find the BIP39 dot map table in the following site.
            https://onekey.so/bip39-dotmap
          </Typography.Body2>
        </Box>
      }
    >
      <FlatList data={walletsData} renderItem={renderItem} />
      <Box mt={2}>
        <Divider />
        <ListItemBase
          onPress={() => {}}
          text="Enter my Recovery Phrase"
          leftView={<Icon name="PencilOutline" />}
          rightView={<Icon name="ChevronRightMini" />}
        />
      </Box>
    </LayoutContainer>
  );
};

export default KeyTagBackUpWallet;
