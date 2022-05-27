import React, { useCallback, useMemo } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Form, Modal, useForm, useToast } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigationActions } from '../../../hooks';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddWatchAccountModal
>;

type AddWatchAccountValues = {
  networkId: string;
  name: string;
};

const AddWatchAccount = () => {
  const {
    params: { address, selectableNetworks },
  } = useRoute<RouteProps>();
  const toast = useToast();
  const { closeDrawer, resetToRoot } = useNavigationActions();
  const { wallets } = useRuntime();
  const { serviceAccount } = backgroundApiProxy;
  const { control, handleSubmit } = useForm<AddWatchAccountValues>({
    defaultValues: { name: '' },
  });
  const intl = useIntl();

  const defaultWalletName = useMemo(() => {
    const walletList = wallets.filter((wallet) => wallet.type === 'watching');
    const wallet = walletList[0];
    const id = wallet?.nextAccountIds?.global;
    if (!id) return '';
    return `Account #${id}`;
  }, [wallets]);

  const onSubmit = useCallback(
    async (values: AddWatchAccountValues) => {
      try {
        await serviceAccount.addWatchAccount(
          values.networkId,
          address,
          values.name || defaultWalletName,
        );
        closeDrawer();
        resetToRoot();
        if (platformEnv.isExtensionUiStandaloneWindow) {
          window?.close?.();
        }
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        toast.show({
          title: intl.formatMessage({ id: errorKey }),
        });
      }
    },
    [
      serviceAccount,
      defaultWalletName,
      address,
      toast,
      intl,
      closeDrawer,
      resetToRoot,
    ],
  );
  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={intl.formatMessage({
        id: 'wallet__watched_accounts',
      })}
      primaryActionProps={{
        type: 'primary',
        onPromise: handleSubmit(onSubmit),
      }}
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

export default AddWatchAccount;
