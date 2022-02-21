import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Control,
  Form,
  KeyboardDismissView,
  Modal,
  useForm,
  useWatch,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import engine from '../../engine/EngineProvider';
import { useGeneral, useManageTokens } from '../../hooks/redux';
import useDebounce from '../../hooks/useDebounce';
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

type AddressInputProps = {
  // eslint-disable-next-line
  control: Control<AddCustomTokenValues, object>;
  onSearch: (token?: Token) => void;
};

const AddressInput: FC<AddressInputProps> = ({ control, onSearch }) => {
  const intl = useIntl();
  const { activeAccount, activeNetwork } = useGeneral();
  const [isSearching, setSearching] = useState(false);

  const watchedAddress = useWatch({ control, name: 'address' });
  const address = useDebounce(watchedAddress, 1000);
  const { accountTokensSet } = useManageTokens();

  const helpTip = intl.formatMessage({
    id: 'form__searching_token',
    defaultMessage: 'Searching Token...',
  });

  useEffect(() => {
    async function doQuery() {
      const trimedAddress = address.trim();
      if (trimedAddress.length === 42 && activeAccount && activeNetwork) {
        let preResult;
        setSearching(true);
        try {
          preResult = await engine.preAddToken(
            activeAccount.id,
            activeNetwork.network.id,
            trimedAddress,
          );
          if (preResult?.[1]) {
            onSearch(preResult?.[1]);
          } else {
            onSearch(undefined);
          }
        } finally {
          setSearching(false);
        }
      }
    }
    doQuery();
  }, [address, activeAccount, activeNetwork, onSearch]);

  return (
    <Form.Item
      name="address"
      label={intl.formatMessage({
        id: 'transaction__contract_address',
        defaultMessage: 'Contract Address',
      })}
      control={control}
      defaultValue=""
      labelAddon={['paste']}
      helpText={isSearching ? helpTip : undefined}
      rules={{
        required: intl.formatMessage({
          id: 'form__field_is_required',
        }),
        validate: (value) => {
          if (accountTokensSet.has(value)) {
            return intl.formatMessage({ id: 'msg__token_already_existed' });
          }
        },
      }}
    >
      <Form.Textarea
        placeholder={intl.formatMessage({
          id: 'form__enter_or_paste_contract_address',
          defaultMessage: 'Enter or paste contract address',
        })}
      />
    </Form.Item>
  );
};

export const AddCustomToken: FC<NavigationProps> = ({ route }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const [inputDisabled, setInputDisabled] = useState(false);
  const { activeAccount, activeNetwork } = useGeneral();
  const { info } = useToast();
  const address = route.params?.address;
  const { control, handleSubmit, setValue } = useForm<AddCustomTokenValues>({
    defaultValues: { address: '', symbol: '', decimal: '' },
    mode: 'onChange',
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

  const onSearch = useCallback(
    (token?: Token) => {
      if (token) {
        setValue('decimal', String(token.decimals));
        setValue('symbol', token.symbol);
        setInputDisabled(true);
      } else {
        setInputDisabled(false);
        setValue('decimal', '');
        setValue('symbol', '');
      }
    },
    [setValue],
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
      primaryActionProps={{
        type: 'primary',
        onPromise: () => handleSubmit(onSubmit)(),
      }}
      scrollViewProps={{
        children: (
          <KeyboardDismissView>
            <Form>
              <AddressInput control={control} onSearch={onSearch} />
              <Form.Item
                name="symbol"
                label={intl.formatMessage({
                  id: 'form__token_symbol',
                  defaultMessage: 'Token Symbol',
                })}
                rules={{
                  required: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                }}
                defaultValue=""
                control={control}
              >
                <Form.Input isDisabled={inputDisabled} />
              </Form.Item>
              <Form.Item
                name="decimal"
                label={intl.formatMessage({
                  id: 'form__decimal',
                  defaultMessage: 'Decimal',
                })}
                control={control}
                defaultValue=""
                rules={{
                  required: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                }}
              >
                <Form.Input isDisabled={inputDisabled} />
              </Form.Item>
            </Form>
          </KeyboardDismissView>
        ),
      }}
    />
  );
};

export default AddCustomToken;
