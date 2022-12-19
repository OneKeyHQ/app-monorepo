import { useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components/src/Toast/useToast';
import {
  KeyTagVerifyWalletRoutes,
  KeyTagVerifyWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/KeyTagVerifyWallet';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Attentions } from '../../CreateWallet/AppWallet/Attentions';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';

type RouteProps = RouteProp<
  KeyTagVerifyWalletRoutesParams,
  KeyTagVerifyWalletRoutes.KeyTagAttensions
>;
type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const KeyTagBackupWalletAttentions = () => {
  console.log('KeyTagBackupWalletAttentions');
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  const { walletId, password, wallet } = route.params;
  const intl = useIntl();
  const onPress = useCallback(async () => {
    const mnemonic = await backgroundApiProxy.engine.revealHDWalletMnemonic(
      walletId,
      password,
    );
    if (!mnemonic?.length) {
      Toast.show({
        title: 'mnemonic parse error',
      });
      return;
    }
    navigation
      .getParent()
      ?.navigate(KeyTagRoutes.ShowDotMap, { mnemonic, wallet });
  }, [walletId, password, navigation, wallet]);
  return (
    <Attentions
      // pressTitle={intl.formatMessage({ id: 'action__show_dotmap_for_keytag' })}
      pressTitle="Show Dotmap for KeyTag"
      onPress={onPress}
    />
  );
};

export default KeyTagBackupWalletAttentions;
