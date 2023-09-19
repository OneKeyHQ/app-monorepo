import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  BottomSheetModal,
  Button,
  Form,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import type { Account } from '@onekeyhq/engine/src/types/account';
import showDerivationPathBottomSheetModal from '@onekeyhq/kit/src/components/NetworkAccountSelector/modals/NetworkAccountSelectorModal/DerivationPathBottomSheetModal';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDerivationPath } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';
import { deviceUtils } from '../../../utils/hardware';
import { showOverlay } from '../../../utils/overlayUtils';

import { FROM_INDEX_MAX } from './RecoverAccountsAdvanced';

import type { IDerivationOption } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';

type IFindAddressByPathProps = {
  walletId: string;
  networkId: string;
  accountId?: string;
  template?: string;
  onConfirm: ({
    error,
    data,
  }: {
    error: Error | null;
    data: {
      derivationOption: IDerivationOption;
      addressIndex: string;
      accountIndex: string;
      account: Account | null;
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
  template,
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
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    if (accountId && networkId) {
      backgroundApiProxy.engine
        .getAccount(accountId, networkId)
        .then((findAccount) => {
          setAccount(findAccount);
        });
    }
  }, [accountId, networkId]);
  const hasAccount = useMemo(
    () => !!accountId && !!account,
    [accountId, account],
  );
  useEffect(() => {
    if (account) {
      const pathIndex = account.path.split('/')[3].slice(0, -1);
      setValue('accountIndex', pathIndex ?? '');
    }
  }, [account, setValue]);

  const { derivationOptions } = useDerivationPath(walletId, networkId);
  const [selectedDerivation, setSelectedDerivation] =
    useState<IDerivationOption | null>(null);
  useEffect(() => {
    if (!selectedDerivation) {
      const defaultValue = derivationOptions.find(
        (d) => d.template === account?.template || d.template === template,
      );
      if (defaultValue) {
        setSelectedDerivation(defaultValue);
      }
    }
  }, [derivationOptions, account?.template, selectedDerivation, template]);
  useEffect(() => {
    if (selectedDerivation && typeof selectedDerivation.label === 'string') {
      setValue('derivationType', selectedDerivation.label);
    }
  }, [selectedDerivation, setValue]);

  const onSelectDerivationType = useCallback(() => {
    if (hasAccount) return;
    showDerivationPathBottomSheetModal({
      type: 'search',
      walletId,
      networkId,
      onSelect: (option) => setSelectedDerivation(option),
    });
  }, [networkId, walletId, hasAccount]);

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
              accountIndex: data.accountIndex,
              account: res,
            },
          });
        })
        .catch((e) => {
          debugLogger.common.debug(
            'can not find account, will create one: ',
            e,
          );
          onConfirm({
            error: null,
            data: {
              derivationOption: selectedDerivation,
              addressIndex: data.addressIndex,
              accountIndex: data.accountIndex,
              account: null,
            },
          });
        });
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
    <>
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
      <Form my={6}>
        <Pressable onPress={onSelectDerivationType} isDisabled={hasAccount}>
          <Form.Item name="derivationType" control={control}>
            <Form.Input
              size={isSmallScreen ? 'xl' : 'default'}
              rightIconName="ChevronDownMini"
              isReadOnly
              isDisabled={hasAccount}
              onPressRightIcon={onSelectDerivationType}
              onPressIn={
                platformEnv.isNativeIOS ? onSelectDerivationType : undefined
              }
            />
          </Form.Item>
        </Pressable>
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
            isReadOnly={hasAccount}
            isDisabled={hasAccount}
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
    </>
  );
};

const showFindAddressByPathBottomSheetModal = ({
  walletId,
  networkId,
  accountId,
  template,
  onConfirm,
}: IFindAddressByPathProps) => {
  showOverlay((close) => (
    <BottomSheetModal
      title={formatMessage({
        id: 'action__find_address_by_path',
      })}
      closeOverlay={close}
      modalLizeProps={{
        avoidKeyboardLikeIOS: false,
      }}
    >
      <FindAddressByPathContent
        walletId={walletId}
        networkId={networkId}
        accountId={accountId}
        template={template}
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
