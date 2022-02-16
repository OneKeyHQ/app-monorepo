import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, useForm, useToast } from '@onekeyhq/components';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import engine from '@onekeyhq/kit/src/engine/EngineProvider';
import { useAppDispatch } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { setRefreshTS } from '@onekeyhq/kit/src/store/reducers/settings';

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
  const { control, handleSubmit } = useForm<WatchedAccountFormValues>();
  const navigation = useNavigation<NavigationProps>();
  const dispatch = useAppDispatch();
  const onSubmit = handleSubmit(async (data) => {
    try {
      await engine.addWatchingAccount(data.network, data.address, data.name);

      toast.show({
        title: intl.formatMessage({ id: 'msg__submitted_successfully' }),
      });
      dispatch(setRefreshTS());
      navigation.goBack();
    } catch (e) {
      toast.show({
        title: (e as { key: string }).key,
      });
    }
  });

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={intl.formatMessage({ id: 'wallet__watched_accounts' })}
      primaryActionTranslationId="action__import"
      onPrimaryActionPress={() => onSubmit()}
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
                  required: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                }}
                label={intl.formatMessage({ id: 'form__account_name' })}
                control={control}
              >
                <Form.Input />
              </Form.Item>
              <Form.Item
                labelAddon={['paste']}
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
