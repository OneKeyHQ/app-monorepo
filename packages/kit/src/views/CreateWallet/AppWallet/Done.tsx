import React, { FC, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';

import { useDrawer, useToast } from '../../../hooks';
import { setEnableLocalAuthentication } from '../../../store/reducers/settings';
import { savePassword } from '../../../utils/localAuthentication';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AppWalletDoneModal
>;

type DoneProps = {
  password: string;
  mnemonic?: string;
  withEnableAuthentication?: boolean;
};

const Done: FC<DoneProps> = ({
  password,
  mnemonic,
  withEnableAuthentication,
}) => {
  const navigation = useNavigation();
  const intl = useIntl();
  const toast = useToast();
  const { closeDrawer } = useDrawer();
  useEffect(() => {
    async function main() {
      try {
        await backgroundApiProxy.serviceAccount.createHDWallet({
          password,
          mnemonic,
        });
        if (withEnableAuthentication) {
          backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
          await savePassword(password);
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        toast.show({ title: intl.formatMessage({ id: errorKey }) });
      }
      closeDrawer();
      const inst = navigation.getParent() || navigation;
      inst.goBack();
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

export const AppWalletDone = () => {
  const route = useRoute<RouteProps>();
  const { mnemonic } = route.params ?? {};
  return (
    <Modal footer={null}>
      <Protected skipSavePassword field={ValidationFields.Wallet}>
        {(password, { withEnableAuthentication }) => (
          <Done
            password={password}
            mnemonic={mnemonic}
            withEnableAuthentication={withEnableAuthentication}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default AppWalletDone;
