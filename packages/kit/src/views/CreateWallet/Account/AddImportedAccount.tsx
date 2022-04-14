import React, { useCallback, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Form, Modal, useForm } from '@onekeyhq/components';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddImportedAccountModal
>;

type AddImportedAccountValues = {
  name: string;
  networkId: string;
};

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const AddImportedAccount = () => {
  const { control, handleSubmit } = useForm<AddImportedAccountValues>();
  const {
    params: { privatekey, selectableNetworks },
  } = useRoute<RouteProps>();
  const intl = useIntl();
  const { wallets } = useRuntime();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const defaultWalletName = useMemo(() => {
    const walletList = wallets.filter((wallet) => wallet.type === 'imported');
    const wallet = walletList[0];
    const id = wallet?.nextAccountIds?.global;
    if (!id) return '';
    return `Account #${id}`;
  }, [wallets]);

  const onSubmit = useCallback(
    (values: AddImportedAccountValues) => {
      navigation.navigate(CreateWalletModalRoutes.AddImportedAccountDoneModal, {
        privatekey,
        networkId: values.networkId,
        name: values.name || defaultWalletName,
      });
    },
    [defaultWalletName, navigation, privatekey],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={intl.formatMessage({
        id: 'wallet__imported_accounts',
      })}
      primaryActionProps={{ type: 'primary', onPress: handleSubmit(onSubmit) }}
      primaryActionTranslationId="action__import"
      hideSecondaryAction
    >
      <Form>
        <FormChainSelector
          selectableNetworks={selectableNetworks}
          control={control}
          name="networkId"
        />
        <Form.Item
          name="name"
          label={intl.formatMessage({ id: 'form__account_name' })}
          control={control}
        >
          <Form.Input placeholder={defaultWalletName} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddImportedAccount;
