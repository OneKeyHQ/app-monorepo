import React, { FC, useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';

import { Box, Form, Modal, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import {
  ImportAccountModalRoutes,
  ImportAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import { setRefreshTS } from '@onekeyhq/kit/src/store/reducers/settings';

type PrivateKeyFormValues = {
  network: string;
  name: string;
  privateKey: string;
};

const ImportedAccount: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  // const [activeSegment, setActiveSegment] = useState('privateKey');
  const { dispatch, engine } = backgroundApiProxy;
  const { control, handleSubmit, getValues } = useForm<PrivateKeyFormValues>();

  const authenticationDone = useCallback(
    async (password) => {
      const network = getValues('network');
      const privateKey = getValues('privateKey');
      const name = getValues('name');
      console.log('[privateKey]', network, name, privateKey);
      const account = await engine.addImportedAccount(
        password,
        network,
        privateKey,
        name,
      );

      dispatch(setRefreshTS());
      console.log(account);
    },
    [getValues, engine, dispatch],
  );

  const onSubmit = handleSubmit(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ImportAccount,
      params: {
        screen: ImportAccountModalRoutes.ImportAccountAuthentication,
        params: {
          onDone: authenticationDone,
        },
      },
    });
  });

  return (
    <Modal
      hideSecondaryAction
      height="640px"
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={intl.formatMessage({
        id: 'wallet__imported_accounts',
      })}
      primaryActionTranslationId="action__import"
      primaryActionProps={{ onPromise: onSubmit }}
      scrollViewProps={{
        children: (
          <>
            <Box
              w="full"
              display="flex"
              flex="1"
              flexDirection="row"
              justifyContent="center"
            >
              <Form w="full">
                <FormChainSelector control={control} name="network" />
                <Form.Item
                  name="name"
                  label={intl.formatMessage({ id: 'form__account_name' })}
                  control={control}
                >
                  <Form.Input />
                </Form.Item>
                <Form.Item
                  name="privateKey"
                  labelAddon={['paste']}
                  label={intl.formatMessage({ id: 'form__private_key' })}
                  control={control}
                  helpText={intl.formatMessage({
                    id: 'form__private_key_helperText',
                  })}
                >
                  <Form.Textarea />
                </Form.Item>
              </Form>
            </Box>

            {/* <Box mb="4" w="full">
              <SegmentedControl
                containerProps={{
                  width: '100%',
                }}
                defaultValue={activeSegment}
                onChange={setActiveSegment}
                options={[
                  {
                    label: intl.formatMessage({ id: 'form__private_key' }),
                    value: 'privateKey',
                  },
                  {
                    label: intl.formatMessage({ id: 'form__keystore' }),
                    value: 'keystore',
                  },
                ]}
              />
            </Box> */}
            {/* {activeSegment === 'privateKey' && <PrivateKeyForm />}
            {activeSegment === 'keystore' && <KeyStoreForm />} */}
          </>
        ),
      }}
    />
  );
};

export default ImportedAccount;
