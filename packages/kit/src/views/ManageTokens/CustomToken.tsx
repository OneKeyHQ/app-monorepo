import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Form,
  KeyboardDismissView,
  Modal,
  useForm,
} from '@onekeyhq/components';

import engine from '../../engine/EngineProvider';
import { useGeneral } from '../../hooks/redux';
import { useToast } from '../../hooks/useToast';

import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type NavigationProps = NativeStackScreenProps<
  ManageTokenRoutesParams,
  ManageTokenRoutes.CustomToken
>;

type AddCustomTokenValues = {
  address: string;
  symbol: string;
  decimal: string;
};

export const AddCustomToken: FC<NavigationProps> = ({ route }) => {
  const intl = useIntl();
  const helpTip = intl.formatMessage({
    id: 'form__searching_token',
    defaultMessage: 'Searching Token...',
  });
  const navigation = useNavigation();
  const [isDisabled, setIsDisabled] = useState(false);
  const [isSearching, setSearching] = useState(false);
  const { activeAccount, activeNetwork } = useGeneral();
  const { info } = useToast();
  const address = route.params?.address;
  const { control, handleSubmit, setValue, watch } =
    useForm<AddCustomTokenValues>({
      defaultValues: { address: '', symbol: '', decimal: '' },
    });
  useEffect(() => {
    if (address) {
      setValue('address', address);
    }
  }, [address, setValue]);
  const onSubmit = useCallback(
    async (data: AddCustomTokenValues) => {
      if (activeNetwork && activeAccount) {
        const preResult = await engine.preAddToken(
          activeAccount.id,
          activeNetwork.network.id,
          data.address,
        );
        if (preResult) {
          engine.addTokenToAccount(activeAccount.id, preResult[1].id);
          info(
            intl.formatMessage({
              id: 'msg__token_added',
              defaultMessage: 'Token Added',
            }),
          );
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }
      }
    },
    [navigation, activeNetwork, activeAccount, intl, info],
  );
  const watchAddress = watch('address');
  useEffect(() => {
    async function doQuery() {
      const trimedAddress = watchAddress.trim();
      // now support evm chain
      if (trimedAddress.length === 42 && activeAccount && activeNetwork) {
        let preResult;
        setSearching(true);
        try {
          preResult = await engine.preAddToken(
            activeAccount.id,
            activeNetwork.network.id,
            trimedAddress,
          );
        } finally {
          setSearching(false);
        }
        if (preResult) {
          setValue('decimal', String(preResult[1].decimals));
          setValue('symbol', preResult[1].symbol);
          setIsDisabled(true);
        }
      } else {
        setIsDisabled(false);
      }
    }
    doQuery();
  }, [watchAddress, activeAccount, activeNetwork, setValue]);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'action__add_custom_tokens',
        defaultMessage: 'Add Custom Token',
      })}
      height="560px"
      hideSecondaryAction
      primaryActionTranslationId="action__add"
      primaryActionProps={{
        type: 'primary',
        onPromise: () => handleSubmit(onSubmit)(),
      }}
      scrollViewProps={{
        children: (
          <KeyboardDismissView>
            <Form>
              <Form.Item
                name="address"
                label={intl.formatMessage({
                  id: 'transaction__contract_address',
                  defaultMessage: 'Contract Address',
                })}
                control={control}
                labelAddon={['paste']}
                helpText={isSearching ? helpTip : undefined}
              >
                <Form.Textarea
                  placeholder={intl.formatMessage({
                    id: 'form__enter_or_paste_contract_address',
                    defaultMessage: 'Enter or paste contract address',
                  })}
                />
              </Form.Item>
              <Form.Item
                name="symbol"
                label={intl.formatMessage({
                  id: 'form__token_symbol',
                  defaultMessage: 'Token Symbol',
                })}
                control={control}
              >
                <Form.Input isDisabled={isDisabled} />
              </Form.Item>
              <Form.Item
                name="decimal"
                label={intl.formatMessage({
                  id: 'form__decimal',
                  defaultMessage: 'Decimal',
                })}
                control={control}
              >
                <Form.Input isDisabled={isDisabled} />
              </Form.Item>
            </Form>
          </KeyboardDismissView>
        ),
      }}
    />
  );
};

export default AddCustomToken;
