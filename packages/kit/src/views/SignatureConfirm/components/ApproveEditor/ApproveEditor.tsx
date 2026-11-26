import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { type Atom, atom, useAtomValue } from 'jotai';
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
} from '@onekeyhq/components';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTokenApproveAllowance } from '@onekeyhq/kit/src/hooks/useTokenApproveAllowance';
import {
  tokenApproveInfoAtom,
  unsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { IJotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EApproveType } from '@onekeyhq/shared/types/tx';

import { SignatureConfirmTestIDs } from '../../testIDs';

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

type IAllowance = Pick<IProps, 'allowance' | 'isUnlimited'>;

function ApproveEditor(
  props: IProps & {
    store: IJotaiContextStore;
    updatingAtom: Atom<boolean>;
    onSave: (edit: IAllowance) => Promise<void>;
  },
) {
  const intl = useIntl();
  const updating = useAtomValue(props.updatingAtom, { store: props.store });

  const {
    accountId,
    networkId,
    allowance,
    isUnlimited,
    tokenDecimals,
    tokenAddress,
    balanceParsed,
    tokenSymbol,
    onSave,
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
                disabled={updating}
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
            editable={!updating && !watchAllFields.isUnlimited}
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
              disabled={updating}
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
          disabled: updating || !form.formState.isValid,
        }}
        onConfirm={async () => {
          const edit = form.getValues();
          if (edit.allowance !== '') await onSave(edit);
        }}
        cancelButtonProps={{ disabled: updating }}
        onCancelText={intl.formatMessage({
          id: ETranslations.global_reset,
        })}
      />
    </>
  );
}

const showApproveEditor = (store: IJotaiContextStore, props: IProps) => {
  const unsignedTxs = store.get(unsignedTxsAtom());
  const original = store.get(tokenApproveInfoAtom());
  const updatingAtom = atom(false);

  // The dialog lives in a portal. Keep its writes bound to the transaction
  // that opened it, even if the route's queue advances during the rewrite.
  const updateAllowance = async (edit: IAllowance) => {
    if (store.get(updatingAtom) || store.get(unsignedTxsAtom()) !== unsignedTxs)
      return false;
    store.set(updatingAtom, true);
    try {
      const updatedTx = await backgroundApiProxy.serviceSend.updateUnsignedTx({
        accountId: props.accountId,
        networkId: props.networkId,
        unsignedTx: unsignedTxs[0],
        tokenApproveInfo: {
          ...edit,
          approveType: props.approveType ?? EApproveType.Approve,
        },
      });
      if (store.get(unsignedTxsAtom()) !== unsignedTxs) return false;
      store.set(unsignedTxsAtom(), [updatedTx]);
      return true;
    } finally {
      store.set(updatingAtom, false);
    }
  };

  const onSave = async (edit: IAllowance) => {
    if (await updateAllowance(edit)) props.onChangeTokenApproveInfo?.(edit);
  };

  Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.approve_edit_title,
    }),
    showExitButton: false,
    onBeforeClose: () => !store.get(updatingAtom),
    onCancel: async (close) => {
      if (store.get(updatingAtom)) return;
      if (
        !new BigNumber(props.allowance).isEqualTo(original.originalAllowance) ||
        props.isUnlimited !== original.originalIsUnlimited
      ) {
        await updateAllowance({
          allowance: original.originalAllowance,
          isUnlimited: original.originalIsUnlimited,
        });
      }
      props.onResetTokenApproveInfo?.();
      await close();
    },
    renderContent: (
      <ApproveEditor
        {...props}
        store={store}
        updatingAtom={updatingAtom}
        onSave={onSave}
      />
    ),
  });
};

export { showApproveEditor };
