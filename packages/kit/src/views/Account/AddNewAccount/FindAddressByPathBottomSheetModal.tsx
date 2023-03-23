import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  BottomSheetModal,
  Box,
  Button,
  Form,
  KeyboardDismissView,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
// import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import type { Account } from '@onekeyhq/engine/src/types/account';
// import showDerivationPathBottomSheetModal from '@onekeyhq/kit/src/components/NetworkAccountSelector/modals/NetworkAccountSelectorModal/DerivationPathBottomSheetModal';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDerivationPath } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';
import { useRuntime } from '../../../hooks/redux';
import { deviceUtils } from '../../../utils/hardware';
import { showOverlay } from '../../../utils/overlayUtils';

import { FROM_INDEX_MAX } from './RecoverAccountsAdvanced';

import type { IDerivationOption } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';

type IFindAddressByPathProps = {
  walletId: string;
  networkId: string;
  accountId: string;
  onConfirm: ({
    error,
    data,
  }: {
    error: Error | null;
    data: {
      derivationOption: IDerivationOption;
      addressIndex: string;
      account: Account;
    } | null;
  }) => void;
};

type IFormValues = {
  derivationType: string;
  accountIndex: string;
  addressIndex: string;
};

const FindAddressByPathContent: FC<IFindAddressByPathProps> = ({
  walletId,
  networkId,
  accountId,
  onConfirm,
}: IFindAddressByPathProps) => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const { control, handleSubmit, setValue } = useForm<IFormValues>({
    defaultValues: {
      derivationType: '',
      accountIndex: '',
      addressIndex: '',
    },
    mode: 'onChange',
  });
  const { accounts } = useRuntime();
  const account = accounts.find((i) => i.id === accountId);
  useEffect(() => {
    const pathIndex = account?.path.split('/')[3].slice(0, -1);
    setValue('accountIndex', pathIndex ?? '');
  }, [account?.path, setValue]);

  const { derivationOptions } = useDerivationPath(walletId, networkId);
  const [selectedDerivation, setSelectedDerivation] =
    useState<IDerivationOption | null>(null);
  useEffect(() => {
    if (!selectedDerivation) {
      const defaultValue = derivationOptions.find(
        (d) => d.template === account?.template,
      );
      if (defaultValue) {
        setSelectedDerivation(defaultValue);
      }
    }
  }, [derivationOptions, account?.template, selectedDerivation]);
  useEffect(() => {
    if (selectedDerivation && typeof selectedDerivation.label === 'string') {
      setValue('derivationType', selectedDerivation.label);
    }
  }, [selectedDerivation, setValue]);

  // const onSelectDerivationType = useCallback(() => {
  //   showDerivationPathBottomSheetModal({
  //     type: 'search',
  //     walletId,
  //     networkId,
  //     onSelect: (option) => setSelectedDerivation(option),
  //   });
  // }, [networkId, walletId]);

  const onSubmit = useCallback(
    (data: IFormValues) => {
      if (!selectedDerivation) return;
      const { category } = selectedDerivation;
      const searchAccountId = `${walletId}--m/${category}/${data.accountIndex}'`;
      backgroundApiProxy.engine
        .getAccount(searchAccountId, networkId)
        .then((res) => {
          onConfirm({
            error: null,
            data: {
              derivationOption: selectedDerivation,
              addressIndex: data.addressIndex,
              account: res,
            },
          });
        })
        .catch((e) => {
          console.log('=====>>>>>errr: ', e);
          onConfirm({ error: e, data: null });
        });
      console.log(selectedDerivation);
    },
    [selectedDerivation, networkId, walletId, onConfirm],
  );

  const isInteger = (value: any) => {
    let amount = 0;
    if (typeof value === 'string') {
      try {
        amount = parseInt(value);
      } catch (error) {
        return false;
      }
    }

    return (
      typeof amount === 'number' &&
      Number.isFinite(amount) &&
      Math.floor(amount) === amount
    );
  };

  const validateIndexTooLarge = useCallback((value: string | number) => {
    if (isInteger(value)) {
      return {
        max: FROM_INDEX_MAX,
        error: new BigNumber(value).isGreaterThan(FROM_INDEX_MAX),
      };
    }
  }, []);

  const indexRules = useMemo(
    () => ({
      required: {
        value: true,
        message: intl.formatMessage({
          id: 'form__field_is_required',
        }),
      },
      min: {
        value: 0,
        message: intl.formatMessage(
          {
            id: 'form__field_too_small',
          },
          {
            0: 0,
          },
        ),
      },
      pattern: {
        value: /^[0-9]*$/,
        message: intl.formatMessage({
          id: 'form__field_only_integer',
        }),
      },
      validate: (value: string | number) => {
        if (!isInteger(value)) {
          return intl.formatMessage({
            id: 'form__field_is_required',
          });
        }
        if (typeof value !== 'boolean') {
          const res = validateIndexTooLarge(value);
          if (res?.error) {
            return intl.formatMessage(
              {
                id: 'form__field_too_large',
              },
              {
                0: res?.max,
              },
            );
          }
        }
      },
    }),
    [validateIndexTooLarge, intl],
  );

  return (
    <Box>
      <Alert
        title={intl.formatMessage({
          id: 'msg__remember_your_path_settings',
        })}
        description={intl.formatMessage({
          id: 'msg__remember_your_path_settings_desc',
        })}
        dismiss={false}
        alertType="info"
        customIconName="InformationCircleMini"
      />
      <KeyboardDismissView>
        <Form my={6}>
          {/* <Pressable onPress={onSelectDerivationType}> */}
          <Form.Item name="derivationType" control={control}>
            <Form.Input
              size={isSmallScreen ? 'xl' : 'default'}
              // rightIconName="ChevronDownMini"
              isReadOnly
              isDisabled
              // onPressRightIcon={onSelectDerivationType}
              // onPressIn={
              //   platformEnv.isNativeIOS ? onSelectDerivationType : undefined
              // }
            />
          </Form.Item>
          {/* </Pressable> */}
          <Form.Item
            name="accountIndex"
            control={control}
            label={intl.formatMessage({
              id: 'form__account',
            })}
            rules={indexRules}
          >
            <Form.Input
              type="number"
              keyboardType="number-pad"
              size={isSmallScreen ? 'xl' : 'default'}
              isReadOnly
              isDisabled
            />
          </Form.Item>
          <Form.Item
            name="addressIndex"
            control={control}
            label="Address_index"
            rules={indexRules}
          >
            <Form.Input
              type="number"
              keyboardType="number-pad"
              size={isSmallScreen ? 'xl' : 'default'}
            />
          </Form.Item>
        </Form>
        <Button
          type="primary"
          size={isSmallScreen ? 'xl' : 'base'}
          onPress={handleSubmit(onSubmit)}
        >
          {intl.formatMessage({ id: 'action__add' })}
        </Button>
      </KeyboardDismissView>
    </Box>
  );
};

const showFindAddressByPathBottomSheetModal = ({
  walletId,
  networkId,
  accountId,
  onConfirm,
}: IFindAddressByPathProps) => {
  showOverlay((close) => (
    <BottomSheetModal
      title={formatMessage({
        id: 'action__find_address_by_path',
      })}
      closeOverlay={close}
    >
      <FindAddressByPathContent
        walletId={walletId}
        networkId={networkId}
        accountId={accountId}
        onConfirm={({ error, data }) => {
          close?.();
          if (error) {
            deviceUtils.showErrorToast(error);
            return;
          }
          onConfirm({ error, data });
        }}
      />
    </BottomSheetModal>
  ));
};

export default showFindAddressByPathBottomSheetModal;
