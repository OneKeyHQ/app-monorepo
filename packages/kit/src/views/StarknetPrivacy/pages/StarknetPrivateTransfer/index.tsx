import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Alert, Form, Page, SizableText, YStack } from '@onekeyhq/components';
import {
  type IFormMode,
  type IReValidateMode,
  useForm,
} from '@onekeyhq/components/src/hooks/useForm';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  AddressInputField,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/components/AddressInput';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { SendAutoSizeAmountInput } from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IStrk20TransferKind,
  IStrk20Warning,
} from '@onekeyhq/shared/types/starknetPrivacy';
import {
  EStrk20ErrorRetry,
  EStrk20WarningCode,
} from '@onekeyhq/shared/types/starknetPrivacy';

import {
  useStarknetPrivacyProtocolFee,
  useStarknetPrivateBalances,
  useStarknetRecipientRequirement,
} from '../../hooks/useStarknetPrivacy';
import {
  formatMockMessage,
  getStrk20RecipientRequirementCopy,
} from '../../utils/starknetPrivacyUtils';

import type { RouteProp } from '@react-navigation/core';

type IFormValues = {
  amount: string;
  to: IAddressInputValue;
};

const TITLE_KEY_BY_KIND: Record<IStrk20TransferKind, ETranslationsMock> = {
  deposit: ETranslationsMock.starknet_privacy_action_deposit,
  withdraw: ETranslationsMock.starknet_privacy_action_withdraw,
  transfer: ETranslationsMock.starknet_privacy_action_send_private,
};

const DESC_KEY_BY_KIND: Record<IStrk20TransferKind, ETranslationsMock> = {
  deposit: ETranslationsMock.starknet_privacy_form_desc_deposit,
  withdraw: ETranslationsMock.starknet_privacy_form_desc_withdraw,
  transfer: ETranslationsMock.starknet_privacy_form_desc_transfer,
};

function StarknetPrivateTransfer() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalSendParamList,
        EModalSendRoutes.SendStarknetPrivateTransfer
      >
    >();
  const { networkId, accountId, kind, token } = route.params;

  const isTransfer = kind === 'transfer';
  const decimals = token.decimals ?? 0;

  const protocolFee = useStarknetPrivacyProtocolFee({ networkId });
  const { balances } = useStarknetPrivateBalances({
    networkId,
    accountId,
    tokenAddress: token.address,
  });

  // Deposits spend the public balance, the other two kinds spend the pool.
  const { result: publicBalanceParsed } = usePromiseResult(
    async () => {
      if (kind !== 'deposit') {
        return undefined;
      }
      try {
        const details =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            networkId,
            accountId,
            contractList: [token.address],
          });
        return details?.[0]?.balanceParsed;
      } catch {
        return undefined;
      }
    },
    [accountId, kind, networkId, token.address],
    { initResult: undefined },
  );

  const privateBalanceParsed = useMemo(() => {
    const raw = balances?.byToken?.[token.address.toLowerCase()];
    if (!raw) {
      return undefined;
    }
    return new BigNumber(raw).shiftedBy(-decimals).toFixed();
  }, [balances?.byToken, decimals, token.address]);

  const availableParsed =
    kind === 'deposit' ? publicBalanceParsed : privateBalanceParsed;

  const formOptions = useMemo(
    () => ({
      defaultValues: {
        amount: '',
        to: { raw: '' } as IAddressInputValue,
      },
      mode: 'onChange' as IFormMode,
      reValidateMode: 'onBlur' as IReValidateMode,
    }),
    [],
  );
  const form = useForm<IFormValues>(formOptions);

  const toValue = form.watch('to') as IAddressInputValue | undefined;
  const recipient = isTransfer ? toValue?.resolved : undefined;

  const { requirement } = useStarknetRecipientRequirement({
    networkId,
    accountId,
    tokenAddress: token.address,
    recipient,
  });
  const recipientCopy = useMemo(
    () =>
      getStrk20RecipientRequirementCopy(isTransfer ? requirement : undefined),
    [isTransfer, requirement],
  );

  const [isBuilding, setIsBuilding] = useState(false);
  const [errorKey, setErrorKey] = useState<
    ETranslations | ETranslationsMock | undefined
  >();
  // Gates the Confirm button: a non-retryable build failure (e.g. a paused
  // pool or a version mismatch) must not invite an identical, doomed rebuild.
  const [errorRetryable, setErrorRetryable] = useState(EStrk20ErrorRetry.Yes);
  const [warnings, setWarnings] = useState<IStrk20Warning[]>([]);
  // A build acknowledged once is reused, so the proving service is not asked
  // twice. The vault refuses a stale build on submit (plan section 2.3).
  const builtTxRef = useRef<IUnsignedTxPro | undefined>(undefined);

  const amountValue = form.watch('amount') as string | undefined;
  // A build belongs to the amount and recipient it was made for; editing
  // either one must not be able to submit the previous proof.
  useEffect(() => {
    builtTxRef.current = undefined;
    setWarnings([]);
    setErrorKey(undefined);
    setErrorRetryable(EStrk20ErrorRetry.Yes);
  }, [amountValue, recipient]);

  const amountRule = useMemo(
    () => ({
      validate: (value: string) => {
        const amount = new BigNumber(value ?? '');
        if (!value || amount.isNaN() || amount.isLessThanOrEqualTo(0)) {
          return formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_amount_required,
          );
        }
        if (availableParsed && amount.isGreaterThan(availableParsed)) {
          return formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_amount_exceeds_available,
          );
        }
        return undefined;
      },
    }),
    [availableParsed, intl],
  );

  const navigateToConfirm = useCallback(
    (unsignedTx: IUnsignedTxPro) => {
      navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
        screen: EModalSignatureConfirmRoutes.TxConfirm,
        params: {
          networkId,
          accountId,
          unsignedTxs: [unsignedTx],
        },
      });
    },
    [accountId, navigation, networkId],
  );

  const handleConfirm = useCallback(async () => {
    if (recipientCopy.blocking) {
      return;
    }
    const isValid = await form.trigger();
    if (!isValid) {
      return;
    }
    if (isTransfer && !recipient) {
      return;
    }
    if (builtTxRef.current) {
      navigateToConfirm(builtTxRef.current);
      return;
    }
    setErrorKey(undefined);
    setErrorRetryable(EStrk20ErrorRetry.Yes);
    setIsBuilding(true);
    try {
      // The service takes base units, matching IStrk20PrivateBalances.byToken.
      const amount = new BigNumber(form.getValues('amount'))
        .shiftedBy(decimals)
        .toFixed(0);
      const result =
        await backgroundApiProxy.serviceStarknetPrivacy.buildPrivateTransferTx({
          networkId,
          accountId,
          kind,
          tokenAddress: token.address,
          amount,
          recipient,
        });
      if (result.warnings?.length) {
        builtTxRef.current = result.unsignedTx;
        setWarnings(result.warnings);
        return;
      }
      navigateToConfirm(result.unsignedTx);
    } catch (error) {
      console.error('starknet private transfer build failed', error);
      const mapped = mapStrk20Error(error);
      setErrorKey(mapped.translationKey);
      setErrorRetryable(mapped.retryable);
    } finally {
      setIsBuilding(false);
    }
  }, [
    accountId,
    decimals,
    form,
    isTransfer,
    kind,
    navigateToConfirm,
    networkId,
    recipient,
    recipientCopy.blocking,
    token.address,
  ]);

  const availableText = useMemo(() => {
    if (!availableParsed) {
      return undefined;
    }
    return formatMockMessage(
      intl,
      kind === 'deposit'
        ? ETranslationsMock.starknet_privacy_available_public
        : ETranslationsMock.starknet_privacy_available_private,
      { amount: availableParsed, symbol: token.symbol },
    );
  }, [availableParsed, intl, kind, token.symbol]);

  const formBody = (
    <Form form={form}>
      <YStack gap="$4">
        <SizableText size="$bodyMd" color="$textSubdued">
          {formatMockMessage(intl, DESC_KEY_BY_KIND[kind], {
            symbol: token.symbol,
          })}
        </SizableText>
        {protocolFee ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {formatMockMessage(
              intl,
              ETranslationsMock.starknet_privacy_banner_protocol_fee,
              { amount: protocolFee },
            )}
          </SizableText>
        ) : null}
        <Form.Field
          name="amount"
          label={intl.formatMessage({ id: ETranslations.send_amount })}
          description={availableText}
          rules={amountRule}
        >
          <SendAutoSizeAmountInput
            tokenSymbol={token.symbol}
            inputProps={{ placeholder: '0', keyboardType: 'decimal-pad' }}
          />
        </Form.Field>
        {isTransfer ? (
          <AddressInputField
            name="to"
            networkId={networkId}
            accountId={accountId}
            enableAddressBook
            enableWalletName
            placeholder={intl.formatMessage({
              id: ETranslations.search_or_paste_address__desc,
            })}
          />
        ) : null}
        {recipientCopy.messageKey ? (
          <Alert
            type={recipientCopy.blocking ? 'critical' : 'info'}
            title={formatMockMessage(intl, recipientCopy.messageKey)}
          />
        ) : null}
        {kind === 'deposit' ? (
          <Alert
            type="info"
            title={formatMockMessage(
              intl,
              ETranslationsMock.starknet_privacy_banner_screening_window,
            )}
          />
        ) : null}
        {warnings.map((warning) => (
          <Alert
            key={warning.code}
            type="warning"
            title={
              warning.code === EStrk20WarningCode.UserLinkage
                ? formatMockMessage(
                    intl,
                    ETranslationsMock.starknet_privacy_warning_user_linkage,
                  )
                : warning.message
            }
          />
        ))}
        {errorKey ? (
          <Alert type="critical" title={formatMockMessage(intl, errorKey)} />
        ) : null}
      </YStack>
    </Form>
  );

  return (
    <Page scrollEnabled>
      <Page.Header title={formatMockMessage(intl, TITLE_KEY_BY_KIND[kind])} />
      <Page.Body px="$5">
        {isTransfer ? (
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.addressInput,
              sceneUrl: '',
            }}
            enabledNum={[0]}
            availableNetworksMap={{
              0: { networkIds: [networkId], defaultNetworkId: networkId },
            }}
          >
            {formBody}
          </AccountSelectorProviderMirror>
        ) : (
          formBody
        )}
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirm={handleConfirm}
          onConfirmText={intl.formatMessage({
            id: warnings.length
              ? ETranslations.global_continue
              : ETranslations.global_next,
          })}
          confirmButtonProps={{
            loading: isBuilding,
            disabled:
              recipientCopy.blocking ||
              (Boolean(errorKey) && errorRetryable === EStrk20ErrorRetry.No),
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default StarknetPrivateTransfer;
