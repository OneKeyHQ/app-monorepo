import type { FC } from 'react';
import { useEffect } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, ToastManager } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/CreateWallet';

import { useNavigation, useNavigationActions } from '../../../hooks';
import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';
import { setEnableLocalAuthentication } from '../../../store/reducers/settings';
import { savePassword } from '../../../utils/localAuthentication';

import type { CreateWalletModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AppWalletDoneModal
>;

type DoneProps = {
  password: string;
  mnemonic?: string;
  withEnableAuthentication?: boolean;
  onSuccess?: (options: { wallet: Wallet }) => void;
};

const Done: FC<DoneProps> = ({
  password,
  mnemonic,
  withEnableAuthentication,
  onSuccess,
}) => {
  const intl = useIntl();

  const { closeWalletSelector, openRootHome } = useNavigationActions();
  useEffect(() => {
    async function main() {
      try {
        const walletAdded =
          await backgroundApiProxy.serviceAccount.createHDWallet({
            password,
            mnemonic,
          });
        if (withEnableAuthentication) {
          backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
          await savePassword(password);
        }
        if (walletAdded) {
          onSuccess?.({
            wallet: walletAdded,
          });
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        ToastManager.show({ title: intl.formatMessage({ id: errorKey }) });
      }
      closeWalletSelector();
      openRootHome();
      closeExtensionWindowIfOnboardingFinished();
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

const AppWalletDone = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { mnemonic, onSuccess } = route.params ?? {};
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);
  return (
    <Modal footer={null} headerShown={false}>
      <Protected
        skipSavePassword
        /** CreateWallet Flow：walletId is null */
        walletId={null}
        field={ValidationFields.Wallet}
      >
        {(password, { withEnableAuthentication }) => (
          <Done
            password={password}
            mnemonic={mnemonic}
            withEnableAuthentication={withEnableAuthentication}
            onSuccess={onSuccess}
          />
        )}
      </Protected>
    </Modal>
  );
};

// Onboarding ImportAccount mnemonic type
export default AppWalletDone;
