import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Form,
  KeyboardDismissView,
  Modal,
  useForm,
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

export const AddCustomToken: FC<NavigationProps> = ({ route }) => {
  const address = route.params?.address;
  const intl = useIntl();
  const { info } = useToast();
  const navigation = useNavigation();
  const [isSearching, setSearching] = useState(false);
  const [inputDisabled, setInputDisabled] = useState(false);
  const { activeAccount, activeNetwork } = useGeneral();
  const { accountTokensSet } = useManageTokens();

  const helpTip = intl.formatMessage({
    id: 'form__searching_token',
    defaultMessage: 'Searching Token...',
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isValid },
    trigger,
    setError,
    watch,
  } = useForm<AddCustomTokenValues>({
    defaultValues: { address: '', symbol: '', decimal: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (address) {
      setValue('address', address);
    }
  }, [address, setValue]);

  const watchedAddress = watch('address');
  const debouncedAddress = useDebounce(watchedAddress, 1000);

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
        trigger('address');
      } else {
        setError('address', {
          message: intl.formatMessage({ id: 'msg__wrong_address_format' }),
        });
        setInputDisabled(false);
        setValue('decimal', '');
        setValue('symbol', '');
      }
    },
    [setValue, trigger, setError, intl],
  );

  useEffect(() => {
    async function doQuery() {
      const trimedAddress = debouncedAddress.trim();
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
  }, [address, activeAccount, activeNetwork, onSearch, debouncedAddress]);

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
        isDisabled: !isValid && !isSearching,
        onPromise: () => handleSubmit(onSubmit)(),
      }}
    >
      <KeyboardDismissView>
        <Form>
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
                if (value.length !== 42) {
                  return intl.formatMessage({
                    id: 'msg__wrong_address_format',
                  });
                }
                if (accountTokensSet.has(value)) {
                  return intl.formatMessage({
                    id: 'msg__token_already_existed',
                  });
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
    </Modal>
  );
};

export default AddCustomToken;
