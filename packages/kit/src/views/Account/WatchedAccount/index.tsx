import React, { FC, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, useForm } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import { useNavigationActions } from '@onekeyhq/kit/src/hooks';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoveryAccountForm
>;
type WatchedAccountFormValues = {
  network: string;
  name: string;
  address: string;
};

const WatchedAccount: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const { control, handleSubmit } = useForm<WatchedAccountFormValues>({
    defaultValues: {
      address: '',
    },
  });
  const { wallets } = useRuntime();
  const { closeDrawer } = useNavigationActions();
  const navigation = useNavigation<NavigationProps>();
  const { serviceAccount } = backgroundApiProxy;

  const defaultWalletName = useMemo(() => {
    const walletList = wallets.filter((wallet) => wallet.type === 'watching');
    const wallet = walletList[0];
    const id = wallet?.nextAccountIds?.global;
    if (!id) return '';
    return `Account #${id}`;
  }, [wallets]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await serviceAccount.addWatchAccount(
        data.network,
        data.address,
        data.name || defaultWalletName,
      );
      const inst = navigation.getParent() || navigation;
      closeDrawer();
      inst.goBack();
    } catch (e) {
      const errorKey = (e as { key: LocaleIds }).key;
      toast.show({
        title: intl.formatMessage({ id: errorKey }),
      });
    }
  });

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={intl.formatMessage({ id: 'wallet__watched_accounts' })}
      primaryActionTranslationId="action__import"
      primaryActionProps={{ onPromise: onSubmit }}
      hideSecondaryAction
      scrollViewProps={{
        children: (
          <Box
            w="full"
            zIndex={999}
            display="flex"
            flex="1"
            flexDirection="row"
            justifyContent="center"
          >
            <Form w="full">
              <FormChainSelector control={control} name="network" />

              <Form.Item
                name="name"
                rules={{
                  maxLength: {
                    value: 24,
                    message: intl.formatMessage({
                      id: 'msg__exceeding_the_maximum_word_limit',
                    }),
                  },
                }}
                label={intl.formatMessage({ id: 'form__account_name' })}
                control={control}
              >
                <Form.Input placeholder={defaultWalletName} />
              </Form.Item>
              <Form.Item
                labelAddon={platformEnv.isExtension ? [] : ['paste']}
                name="address"
                label={intl.formatMessage({ id: 'form__address' })}
                rules={{
                  required: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                }}
                control={control}
                helpText={intl.formatMessage({
                  id: 'form__address_helperText',
                })}
              >
                <Form.Textarea />
              </Form.Item>
            </Form>
          </Box>
        ),
      }}
    />
  );
};

export default WatchedAccount;
