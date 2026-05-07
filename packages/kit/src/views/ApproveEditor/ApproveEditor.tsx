import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  Input,
  NumberSizeableText,
  Skeleton,
  Switch,
  useForm,
} from '@onekeyhq/components';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EApproveType } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useSendConfirmActions,
  useTokenApproveInfoAtom,
  useUnsignedTxsAtom,
} from '../../states/jotai/contexts/sendConfirm';
import { SendConfirmProviderMirror } from '../Send/components/SendConfirmProvider/SendConfirmProviderMirror';

export type IProps = {
  accountId: string;
  networkId: string;
  allowance: string;
  isUnlimited: boolean;
  tokenAddress: string;
  tokenDecimals: number;
  tokenSymbol: string;
  approveInfo?: IApproveInfo;
  // The original on-chain method behind this approve action. Determines
  // whether the allowance value is an absolute target or a delta, and
  // whether the Unlimited toggle is meaningful in this context.
  approveType?: EApproveType;
  onResetTokenApproveInfo?: () => void;
  onChangeTokenApproveInfo?: ({
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

  const [unsignedTxs] = useUnsignedTxsAtom();
  const [tokenApproveInfo] = useTokenApproveInfoAtom();
  const { updateUnsignedTxs } = useSendConfirmActions().current;

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
    approveInfo,
    approveType = EApproveType.Approve,
  } = props;

  const isIncrease = approveType === EApproveType.IncreaseAllowance;
  const isDecrease = approveType === EApproveType.DecreaseAllowance;
  // Unlimited would force a selector switch to approve(MAX), silently
  // overriding the dApp's original method. Restrict the toggle to absolute
  // approve so increase/decreaseAllowance can only edit their delta.
  const showUnlimitedToggle = !isIncrease && !isDecrease;

  const handleUpdateUnsignedTxs = useCallback(
    async ({
      allowance: newAllowance,
      isUnlimited: newIsUnlimited,
    }: {
      allowance: string;
      isUnlimited: boolean;
    }) => {
      const newUnsignedTx =
        await backgroundApiProxy.serviceSend.updateUnsignedTx({
          accountId,
          networkId,
          unsignedTx: unsignedTxs[0],
          tokenApproveInfo: {
            allowance: newAllowance,
            isUnlimited: newIsUnlimited,
            approveType,
          },
        });
      updateUnsignedTxs([newUnsignedTx]);
    },
    [accountId, approveType, networkId, unsignedTxs, updateUnsignedTxs],
  );

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

  const handleValidateApproveAmount = useCallback(
    (value: string) => {
      if (value === 'RESET') {
        return 'RESET';
      }

      // The swap-required-allowance check assumes value is an absolute target.
      // For increase/decreaseAllowance the input is a delta, so skip it.
      if (approveInfo && !isIncrease && !isDecrease) {
        if (form.getValues('isUnlimited')) {
          return true;
        }
        const valueBN = new BigNumber(value);
        if (valueBN.isLessThan(approveInfo.amount)) {
          return intl.formatMessage({
            id: ETranslations.approve_edit_less_than_swap,
          });
        }
      }

      return true;
    },
    [approveInfo, form, intl, isIncrease, isDecrease],
  );

  // English-only fallback labels for inc/dec — no dedicated i18n keys yet.
  let amountFieldLabel = intl.formatMessage({
    id: ETranslations.approve_edit_approve_amount,
  });
  if (isIncrease) {
    amountFieldLabel = 'Increase amount';
  } else if (isDecrease) {
    amountFieldLabel = 'Decrease amount';
  }

  return (
    <>
      <Form form={form}>
        <Form.Field
          label={amountFieldLabel}
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
                const formattedValue = Number.parseFloat(value);
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
                form.setValue(
                  'allowance',
                  valueBN.toFixed(tokenDecimals, BigNumber.ROUND_FLOOR),
                );
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
                <NumberSizeableText
                  size="$bodyMdMedium"
                  formatter="balance"
                  formatterOptions={{
                    tokenSymbol,
                  }}
                  color="$textSubdued"
                >
                  {tokenDetails?.balanceParsed ?? '-'}
                </NumberSizeableText>
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
        {showUnlimitedToggle ? (
          <Form.Field
            horizontal
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
                void form.trigger('allowance');
              },
            }}
          >
            <Switch size="small" />
          </Form.Field>
        ) : null}
      </Form>
      <Dialog.Footer
        confirmButtonProps={{
          disabled: !form.formState.isValid,
        }}
        onConfirm={async ({ close }) => {
          const currentAllowance = form.getValues('allowance');
          const currentIsUnlimited = form.getValues('isUnlimited');

          if (currentAllowance !== '') {
            void handleUpdateUnsignedTxs({
              allowance: currentAllowance,
              isUnlimited: currentIsUnlimited,
            });
            onChangeTokenApproveInfo?.({
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
          void handleUpdateUnsignedTxs({
            allowance: tokenApproveInfo.originalAllowance,
            isUnlimited: tokenApproveInfo.originalIsUnlimited,
          });
          onResetTokenApproveInfo?.();
        }}
      />
    </>
  );
}

const showApproveEditor = (props: IProps) => {
  Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.approve_edit_title,
    }),
    showExitButton: false,
    renderContent: (
      <SendConfirmProviderMirror>
        <ApproveEditor {...props} />
      </SendConfirmProviderMirror>
    ),
  });
};

export { showApproveEditor };
