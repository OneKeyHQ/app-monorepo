import React, { FC, useEffect } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import type { Account } from '@onekeyhq/engine/src/types/account';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';

import { useNavigation } from '../../../hooks';
import { setEnableLocalAuthentication } from '../../../store/reducers/settings';
import { savePassword } from '../../../utils/localAuthentication';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddImportedAccountDoneModal
>;

type DoneProps = {
  password: string;
  privatekey: string;
  name: string;
  networkId: string;
  withEnableAuthentication?: boolean;
  onSuccess?: (options: { account: Account }) => void;
  onFailure?: () => void;
};

const Done: FC<DoneProps> = ({
  privatekey,
  name,
  networkId,
  password,
  withEnableAuthentication,
  onSuccess,
  onFailure,
}) => {
  const intl = useIntl();
  const toast = useToast();
  useEffect(() => {
    async function main() {
      try {
        const accountAdded =
          await backgroundApiProxy.serviceAccount.addImportedAccount(
            password,
            networkId,
            privatekey,
            name,
          );
        if (withEnableAuthentication) {
          backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
          await savePassword(password);
        }
        if (accountAdded) {
          onSuccess?.({
            account: accountAdded,
          });
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        toast.show(
          {
            title: intl.formatMessage({ id: errorKey }),
          },
          { type: 'error' },
        );
        onFailure?.();
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
  const navigation = useNavigation();
  const { privatekey, name, networkId, onSuccess, onFailure } =
    route.params ?? {};
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);
  return (
    <Modal footer={null} headerShown={false}>
      <Protected
        walletId={null}
        skipSavePassword
        field={ValidationFields.Account}
      >
        {(password, { withEnableAuthentication }) => (
          <Done
            withEnableAuthentication={withEnableAuthentication}
            privatekey={privatekey}
            name={name}
            networkId={networkId}
            password={password}
            onSuccess={onSuccess}
            onFailure={onFailure}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default AddImportedAccountDone;
