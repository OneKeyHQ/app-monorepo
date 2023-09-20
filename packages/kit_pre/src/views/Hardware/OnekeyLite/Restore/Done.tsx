import type { FC } from 'react';
import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { Center } from 'native-base';
import { useIntl } from 'react-intl';

import { Modal, Spinner, ToastManager } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes';
import { setEnableLocalAuthentication } from '@onekeyhq/kit/src/store/reducers/settings';
import { savePassword } from '@onekeyhq/kit/src/utils/localAuthentication';

import type { CreateWalletModalRoutes } from '../../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type PasswordViewProps = {
  password: string;
  mnemonic: string;
  withEnableAuthentication?: boolean;
  onSuccess?: () => void;
};

const PasswordView: FC<PasswordViewProps> = ({
  password,
  mnemonic,
  withEnableAuthentication,
  onSuccess,
}) => {
  const { serviceAccount, dispatch } = backgroundApiProxy;
  const intl = useIntl();

  useEffect(() => {
    if (!password) return;

    (async () => {
      try {
        await serviceAccount.createHDWallet({
          password,
          mnemonic,
        });
        if (withEnableAuthentication) {
          dispatch(setEnableLocalAuthentication(true));
          await savePassword(password);
        }
        onSuccess?.();
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        ToastManager.show({ title: intl.formatMessage({ id: errorKey }) });
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Center w="full" h="full">
      <Spinner size="lg" />
    </Center>
  );
};

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal
>;

const OnekeyLiteRestoreDoneView: FC = () => {
  const { onSuccess, mnemonic } = useRoute<RouteProps>().params;
  const navigation = useNavigation();

  return (
    <Modal footer={null}>
      <Protected
        walletId={null}
        skipSavePassword
        field={ValidationFields.Wallet}
      >
        {(password, { withEnableAuthentication }) => (
          <PasswordView
            password={password}
            mnemonic={mnemonic}
            withEnableAuthentication={withEnableAuthentication}
            onSuccess={() => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
              }
              onSuccess?.();
            }}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default OnekeyLiteRestoreDoneView;
