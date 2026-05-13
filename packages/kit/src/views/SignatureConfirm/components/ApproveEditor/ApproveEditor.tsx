import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  Input,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Switch,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTokenApproveAllowance } from '@onekeyhq/kit/src/hooks/useTokenApproveAllowance';
import {
  useSignatureConfirmActions,
  useTokenApproveInfoAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EApproveType } from '@onekeyhq/shared/types/tx';

import { SignatureConfirmTestIDs } from '../../testIDs';
import { SignatureConfirmProviderMirror } from '../SignatureConfirmProvider/SignatureConfirmProviderMirror';

export type IProps = {
  accountId: string;
  networkId: string;
  allowance: string;
  isUnlimited: boolean;
  tokenAddress: string;
  balanceParsed?: string;
  tokenDecimals: number;
  tokenSymbol: string;
  approveInfo?: IApproveInfo;
  approveType?: EApproveType;
  spender?: string;
  // Skips the editor's own allowance fetch when the caller has it.
  currentAllowanceParsed?: string;
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
  const { updateUnsignedTxs } = useSignatureConfirmActions().current;

  const {
    accountId,
    networkId,
    allowance,
    isUnlimited,
    tokenDecimals,
    tokenAddress,
    balanceParsed,
    tokenSymbol,
    onResetTokenApproveInfo,
    onChangeTokenApproveInfo,
    approveInfo,
    approveType = EApproveType.Approve,
    spender,
    currentAllowanceParsed: currentAllowanceParsedFromProps,
  } = props;

  const isIncrease =
    approveType === EApproveType.IncreaseAllowance ||
    approveType === EApproveType.IncreaseApproval;
  // Unlimited would silently rewrite the call to approve(MAX); only allow it
  // for absolute approve.
  const showUnlimitedToggle = !isIncrease;

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
    async () => {
      if (isNil(balanceParsed)) {
        const tokenDetails =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            networkId,
            accountId,
            contractList: [tokenAddress],
          });

        return {
          tokenBalanceParsed: tokenDetails[0]?.balanceParsed,
        };
      }

      return {
        tokenBalanceParsed: balanceParsed,
      };
    },

    [balanceParsed, networkId, accountId, tokenAddress],
    {
      watchLoading: true,
    },
  );

  const tokenBalanceParsed = result?.tokenBalanceParsed;

  const {
    allowanceParsed: fetchedAllowanceParsed,
    isLoading: isAllowanceLoading,
  } = useTokenApproveAllowance({
    enabled: isIncrease && !currentAllowanceParsedFromProps,
    accountId,
    networkId,
    tokenAddress,
    spender,
  });

  const currentAllowanceParsed =
    currentAllowanceParsedFromProps ?? fetchedAllowanceParsed;

  const unlimitedText = intl.formatMessage({
    id: ETranslations.swap_page_provider_approve_amount_un_limit,
  });

  const form = useForm({
    defaultValues: {
      allowance: '',
      isUnlimited: false,
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const watchAllFields = form.watch();

  const handleValidateApproveAmount = useCallback(
    (value: string) => {
      if (value === 'RESET') {
        return 'RESET';
      }

      // approveInfo.amount is an absolute minimum; deltas can't be compared.
      if (approveInfo && !isIncrease) {
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
    [approveInfo, form, intl, isIncrease],
  );

  const amountFieldLabel = intl.formatMessage({
    id: isIncrease
      ? ETranslations.approve_edit_increase_amount
      : ETranslations.approve_edit_approve_amount,
  });

  const finalAllowanceParsed = useMemo(() => {
    if (!isIncrease || !currentAllowanceParsed) return null;
    const deltaStr = watchAllFields.allowance;
    if (!deltaStr || deltaStr === unlimitedText) return currentAllowanceParsed;
    const deltaBN = new BigNumber(deltaStr);
    if (!deltaBN.isFinite()) return currentAllowanceParsed;
    return new BigNumber(currentAllowanceParsed).plus(deltaBN).toFixed();
  }, [
    currentAllowanceParsed,
    isIncrease,
    unlimitedText,
    watchAllFields.allowance,
  ]);

  const showAllowancePreview = isIncrease && Boolean(spender);

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
                void form.trigger('allowance');
                return;
              }

              if (
                !isIncrease &&
                valueBN.isGreaterThanOrEqualTo(ALLOWANCE_MAX)
              ) {
                form.setValue('allowance', unlimitedText);
                form.setValue('isUnlimited', true);
                void form.trigger('allowance');
                return;
              }

              const dp = valueBN.decimalPlaces();
              if (dp && dp > tokenDecimals) {
                form.setValue(
                  'allowance',
                  valueBN.toFixed(tokenDecimals, BigNumber.ROUND_FLOOR),
                );
                void form.trigger('allowance');
              }
            },
          }}
          labelAddon={
            isLoading ? (
              <Skeleton height={20} width={100} />
            ) : (
              <Button
                testID={SignatureConfirmTestIDs.ApproveEditorBalanceButton}
                size="small"
                variant="tertiary"
                icon="WalletOutline"
                onPress={() => {
                  if (
                    !isNil(tokenBalanceParsed) &&
                    !watchAllFields.isUnlimited
                  ) {
                    form.setValue('allowance', tokenBalanceParsed);
                    void form.trigger('allowance');
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
                  {tokenBalanceParsed ?? '-'}
                </NumberSizeableText>
              </Button>
            )
          }
        >
          <Input
            testID={SignatureConfirmTestIDs.ApproveEditorAllowanceInput}
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
            <Switch
              testID={SignatureConfirmTestIDs.ApproveEditorUnlimitedSwitch}
              size="small"
            />
          </Form.Field>
        ) : null}
      </Form>
      {showAllowancePreview ? (
        <YStack gap="$2" pt="$3">
          <XStack jc="space-between" ai="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.approve_edit_current_allowance,
              })}
            </SizableText>
            {isAllowanceLoading ? (
              <Skeleton height={16} width={120} />
            ) : (
              <NumberSizeableText
                size="$bodyMdMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol }}
              >
                {currentAllowanceParsed ?? '-'}
              </NumberSizeableText>
            )}
          </XStack>
          <XStack jc="space-between" ai="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.approve_edit_final_allowance,
              })}
            </SizableText>
            {isAllowanceLoading ? (
              <Skeleton height={16} width={120} />
            ) : (
              <NumberSizeableText
                size="$bodyMdMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol }}
              >
                {finalAllowanceParsed ?? '-'}
              </NumberSizeableText>
            )}
          </XStack>
        </YStack>
      ) : null}
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
          if (
            !(
              new BigNumber(allowance).isEqualTo(
                tokenApproveInfo.originalAllowance,
              ) && isUnlimited === tokenApproveInfo.originalIsUnlimited
            )
          ) {
            void handleUpdateUnsignedTxs({
              allowance: tokenApproveInfo.originalAllowance,
              isUnlimited: tokenApproveInfo.originalIsUnlimited,
            });
          }

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
      <SignatureConfirmProviderMirror>
        <ApproveEditor {...props} />
      </SignatureConfirmProviderMirror>
    ),
  });
};

export { showApproveEditor };
