import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  Input,
  Skeleton,
  Switch,
  useForm,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

export type IProps = {
  accountId: string;
  networkId: string;
  allowance: string;
  isUnlimited: boolean;
  tokenAddress: string;
  tokenDecimals: number;
  tokenSymbol: string;
  onResetTokenApproveInfo: () => void;
  onChangeTokenApproveInfo: ({
    allowance,
    isUnlimited,
  }: {
    allowance: string;
    isUnlimited: boolean;
  }) => void;
};

const ALLOWANCE_MAX = 10_000_000_000_000;

function ApproveEditor(props: IProps) {
  const intl = useIntl();

  const {
    accountId,
    networkId,
    allowance,
    isUnlimited,
    tokenAddress,
    tokenDecimals,
    tokenSymbol,
    onResetTokenApproveInfo,
    onChangeTokenApproveInfo,
  } = props;

  const { result, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceToken.fetchTokensDetails({
        networkId,
        accountId,
        contractList: [tokenAddress],
      }),
    [accountId, networkId, tokenAddress],
    {
      watchLoading: true,
    },
  );

  const tokenDetails = result?.[0];

  const handleValidateApproveAmount = useCallback((value: string) => {
    if (value === 'RESET') {
      return 'RESET';
    }
    return true;
  }, []);

  const unlimitedText = intl.formatMessage({
    id: ETranslations.swap_page_provider_approve_amount_un_limit,
  });

  const form = useForm({
    defaultValues: {
      allowance: '',
      isUnlimited: false,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const watchAllFields = form.watch();

  return (
    <>
      <Form form={form}>
        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.approve_edit_approve_amount,
          })}
          name="allowance"
          rules={{
            validate: handleValidateApproveAmount,
            onChange: (e: { target: { name: string; value: string } }) => {
              const value = e.target?.value;
              if (value === unlimitedText) {
                return;
              }
              const valueBN = new BigNumber(value ?? 0);
              if (valueBN.isNaN()) {
                const formattedValue = parseFloat(value);
                form.setValue(
                  'allowance',
                  isNaN(formattedValue) ? '' : String(formattedValue),
                );
                return;
              }

              if (valueBN.isGreaterThanOrEqualTo(ALLOWANCE_MAX)) {
                form.setValue('allowance', unlimitedText);
                form.setValue('isUnlimited', true);
                return;
              }

              const dp = valueBN.decimalPlaces();
              if (dp && dp > tokenDecimals) {
                form.setValue('allowance', valueBN.toFixed(tokenDecimals));
              }
            },
          }}
          labelAddon={
            isLoading ? (
              <Skeleton height={20} width={100} />
            ) : (
              <Button
                size="small"
                variant="tertiary"
                icon="WalletOutline"
                onPress={() => {
                  if (tokenDetails && !watchAllFields.isUnlimited) {
                    form.setValue('allowance', tokenDetails.balanceParsed);
                  }
                }}
              >
                {tokenDetails?.balanceParsed ?? '-'}
              </Button>
            )
          }
        >
          <Input
            flex={1}
            editable={!watchAllFields.isUnlimited}
            addOns={[
              {
                label: tokenSymbol,
              },
            ]}
            placeholder={
              isUnlimited
                ? intl.formatMessage({
                    id: ETranslations.swap_page_provider_approve_amount_un_limit,
                  })
                : allowance
            }
          />
        </Form.Field>
        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.approve_edit_unlimited_amount,
          })}
          name="isUnlimited"
          rules={{
            onChange: (e: { target: { name: string; value: boolean } }) => {
              const value = e.target?.value;
              if (value) {
                form.setValue('allowance', unlimitedText);
              } else {
                form.setValue('allowance', isUnlimited ? '' : allowance);
              }
            },
          }}
        >
          <Switch size="small" />
        </Form.Field>
      </Form>
      <Dialog.Footer
        onConfirm={async ({ close }) => {
          const currentAllowance = form.getValues('allowance');
          const currentIsUnlimited = form.getValues('isUnlimited');

          if (currentAllowance !== '') {
            onChangeTokenApproveInfo({
              allowance: currentAllowance,
              isUnlimited: currentIsUnlimited,
            });
          }

          void close();
        }}
        onCancelText={intl.formatMessage({
          id: ETranslations.global_reset,
        })}
        onCancel={() => {
          onResetTokenApproveInfo();
        }}
      />
    </>
  );
}

const showApproveEditor = (props: IProps) => {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.approve_edit_title,
    }),
    renderContent: <ApproveEditor {...props} />,
  });
};

export { showApproveEditor };
