import React, { FC, useEffect } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { Account } from '@onekeyhq/engine/src/types/account';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';

import { useNavigation, useNavigationActions } from '../../../hooks';
import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';
import { setOnBoardingLoadingBehindModal } from '../../../store/reducers/runtime';
import { setEnableLocalAuthentication } from '../../../store/reducers/settings';
import { wait } from '../../../utils/helper';
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
};

const Done: FC<DoneProps> = ({
  privatekey,
  name,
  networkId,
  password,
  withEnableAuthentication,
  onSuccess,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const { closeWalletSelector, openRootHome } = useNavigationActions();
  useEffect(() => {
    async function main() {
      const navigateDelay = 100;
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
      }
      backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(true));
      await wait(navigateDelay);

      closeWalletSelector();
      openRootHome();
      closeExtensionWindowIfOnboardingFinished();

      await wait(600);
      backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
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
  const { privatekey, name, networkId, onSuccess } = route.params ?? {};
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
          />
        )}
      </Protected>
    </Modal>
  );
};

export default AddImportedAccountDone;
