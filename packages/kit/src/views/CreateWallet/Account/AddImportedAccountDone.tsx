import React, { FC, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';

import { useToast } from '../../../hooks';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddImportedAccountDoneModal
>;

type DoneProps = {
  password: string;
  privatekey: string;
  name: string;
  networkId: string;
};

const Done: FC<DoneProps> = ({ privatekey, name, networkId, password }) => {
  const { serviceApp } = backgroundApiProxy;
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  useEffect(() => {
    async function main() {
      try {
        await serviceApp.addImportedAccount(
          password,
          networkId,
          privatekey,
          name,
        );
        const inst = navigation.getParent() || navigation;
        inst.goBack();
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        toast.show({
          title: intl.formatMessage({ id: errorKey }),
        });
      }
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

export const AddImportedAccountDone = () => {
  const route = useRoute<RouteProps>();
  const { privatekey, name, networkId } = route.params ?? {};
  return (
    <Modal footer={null}>
      <Protected skipSavePassword>
        {(password) => (
          <Done
            privatekey={privatekey}
            name={name}
            networkId={networkId}
            password={password}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default AddImportedAccountDone;
