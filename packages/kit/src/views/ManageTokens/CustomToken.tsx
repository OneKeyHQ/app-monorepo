import React, { FC, useCallback, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  KeyboardDismissView,
  Modal,
  Pressable,
  useForm,
} from '@onekeyhq/components';

import engine from '../../engine/EngineProvider';
import { useGeneral } from '../../hooks/redux';
import { useToast } from '../../hooks/useToast';
import { getClipboard } from '../../utils/ClipboardUtils';

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
  const navigation = useNavigation();
  const { activeAccount, activeNetwork } = useGeneral();
  const { info } = useToast();
  const address = route.params?.address;
  const { control, handleSubmit, setValue } = useForm<AddCustomTokenValues>({
    defaultValues: { address: '', symbol: '', decimal: '' },
  });
  useEffect(() => {
    if (address) {
      setValue('address', address);
    }
  }, [address, setValue]);
  const onSubmit = useCallback(
    async (data: AddCustomTokenValues) => {
      console.log(data);
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

  return (
    <Modal
      header={intl.formatMessage({
        id: 'action__add_custom_tokens',
        defaultMessage: 'Add Custom Token',
      })}
      height="560px"
      hideSecondaryAction
      primaryActionTranslationId="action__add"
      primaryActionProps={{ type: 'primary' }}
      onPrimaryActionPress={() => handleSubmit(onSubmit)()}
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
                labelAddon={
                  <Pressable
                    onPress={() => {
                      getClipboard().then((text) => setValue('address', text));
                    }}
                  >
                    <Icon size={16} name="ClipboardSolid" />
                  </Pressable>
                }
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
                <Form.Input />
              </Form.Item>
              <Form.Item
                name="decimal"
                label={intl.formatMessage({
                  id: 'form__decimal',
                  defaultMessage: 'Decimal',
                })}
                control={control}
              >
                <Form.Input />
              </Form.Item>
            </Form>
          </KeyboardDismissView>
        ),
      }}
    />
  );
};

export default AddCustomToken;
