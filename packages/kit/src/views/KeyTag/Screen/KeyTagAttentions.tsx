import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Attentions } from '../../CreateWallet/AppWallet/Attentions';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagRoutes } from '../Routes/enums';

import type { IKeytagRoutesParams } from '../Routes/types';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RouteProps = RouteProp<IKeytagRoutesParams, KeyTagRoutes.KeyTagAttention>;
type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const KeyTagBackupWalletAttentions = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  const { walletId, password, wallet, navigateMode } = route.params;
  const intl = useIntl();
  const onPress = useCallback(async () => {
    const mnemonic = await backgroundApiProxy.engine.revealHDWalletMnemonic(
      walletId,
      password,
    );
    if (!mnemonic?.length) {
      ToastManager.show({
        title: 'mnemonic parse error',
      });
      return;
    }
    navigation.navigate(KeyTagRoutes.ShowDotMap, { mnemonic, wallet });
  }, [walletId, password, navigation, wallet]);
  const modalContent = useMemo(
    () => (
      <Attentions
        pressTitle={intl.formatMessage({
          id: 'action__show_dotmap_for_keytag',
        })}
        onPress={onPress}
        navigateMode={navigateMode}
      />
    ),
    [intl, navigateMode, onPress],
  );
  if (!navigateMode) return modalContent;
  return <LayoutContainer>{modalContent}</LayoutContainer>;
};

export default KeyTagBackupWalletAttentions;
