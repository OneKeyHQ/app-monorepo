/* eslint-disable no-continue */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useWatch } from 'react-hook-form';
import { useIntl } from 'react-intl';

import {
  Form,
  SizableText,
  YStack,
  useFormContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useDebouncedValidation } from '@onekeyhq/kit/src/views/BulkSend/hooks/useDebouncedValidation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

import { useBulkSendAddressesInputContext } from '../Context';

import LineNumberedTextArea, {
  ELineAnnotationType,
} from './LineNumberedTextArea';
import {
  type IBulkSendSelectorAccountItem,
  buildBulkSendSelectorAddressKey,
  resolveBulkSendSelectorFallbackAccount,
} from './senderSelectorAccountUtils';
import { useMultiLineAddressValidation } from './useMultiLineAddressValidation';

type IReceiverAddressesInputProps = {
  maxLines?: number;
};

function buildReceiverSelectorAccountItem(
  activeAccount: IAccountSelectorActiveAccountInfo,
): IBulkSendSelectorAccountItem | undefined {
  if (
    !activeAccount.wallet ||
    !activeAccount.account?.id ||
    !activeAccount.account.address
  ) {
    return undefined;
  }

  return {
    address: activeAccount.account.address,
    walletName: activeAccount.wallet.name,
    accountName: activeAccount.account.name,
    accountId: activeAccount.account.id,
    indexedAccountId: activeAccount.indexedAccount?.id,
  };
}

function useReceiverSelectorAccountItems() {
  const selectorAccountItemsRef = useRef<
    Record<string, IBulkSendSelectorAccountItem>
  >({});

  const handleActiveAccountChange = useCallback(
    (activeAccount: IAccountSelectorActiveAccountInfo) => {
      const selectorAccountItem =
        buildReceiverSelectorAccountItem(activeAccount);
      if (selectorAccountItem) {
        selectorAccountItemsRef.current[
          buildBulkSendSelectorAddressKey(selectorAccountItem.address)
        ] = selectorAccountItem;
        void backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
      }
    },
    [],
  );

  return {
    selectorAccountItemsRef,
    handleActiveAccountChange,
  };
}

// ManyToOne: single-line receiver input
function SingleLineReceiverInput() {
  const intl = useIntl();
  const { selectedAccountId, selectedNetworkId, setDuplicateAddressCount } =
    useBulkSendAddressesInputContext();
  const { network } = useAccountData({ networkId: selectedNetworkId });
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const validationSeqRef = useRef(0);
  const { selectorAccountItemsRef, handleActiveAccountChange } =
    useReceiverSelectorAccountItems();

  const handleValidateAddresses = useCallback(
    async (value: string) => {
      validationSeqRef.current += 1;

      if (!value) {
        setDuplicateAddressCount(0);
        return intl.formatMessage({
          id: ETranslations.wallet_bulk_send_error_receiver_required,
        });
      }

      const trimmedAddress = value.trim();

      const networkId = selectedNetworkId ?? '';
      const result =
        await backgroundApiProxy.serviceValidator.localValidateAddress({
          networkId,
          address: trimmedAddress,
        });

      if (!result.isValid) {
        let networkName = network?.name ?? '';
        if (networkId && networkId !== network?.id) {
          try {
            const networkInfo =
              await backgroundApiProxy.serviceNetwork.getNetwork({
                networkId,
              });
            networkName = networkInfo.name;
          } catch {
            // fallback to hook value
          }
        }
        return intl.formatMessage(
          {
            id: ETranslations.wallet_bulk_send_error_invalid_network_address,
          },
          { network: networkName },
        );
      }

      // Allowlist check
      if (isEnableTransferAllowList && selectedNetworkId) {
        let isAllowed = false;
        const fallbackAccountItem =
          selectorAccountItemsRef.current[
            buildBulkSendSelectorAddressKey(trimmedAddress)
          ];
        try {
          const isBTCNetwork = networkUtils.isBTCNetwork(selectedNetworkId);
          let walletAccountItems: { accountId: string }[] =
            await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
              networkId: selectedNetworkId,
              address: trimmedAddress,
            });
          if (walletAccountItems.length === 0 && isBTCNetwork) {
            walletAccountItems =
              await backgroundApiProxy.serviceFreshAddress.getAccountNameFromFreshAddress(
                {
                  address: trimmedAddress,
                  networkId: selectedNetworkId,
                },
              );
          }
          if (
            walletAccountItems.some((item) =>
              accountUtils.isOwnAccount({ accountId: item.accountId }),
            )
          ) {
            isAllowed = true;
          } else {
            const fallbackResult = await resolveBulkSendSelectorFallbackAccount(
              {
                fallbackAccountItem,
                networkId: selectedNetworkId,
              },
            );
            if (
              fallbackResult?.type === 'resolved' &&
              accountUtils.isOwnAccount({
                accountId: fallbackResult.accountId,
              })
            ) {
              isAllowed = true;
            }
          }
        } catch {
          // ignore
        }
        if (!isAllowed) {
          try {
            const isEvmNetwork = networkUtils.isEvmNetwork({
              networkId: selectedNetworkId,
            });
            const addressBookItem =
              await backgroundApiProxy.serviceAddressBook.findItem({
                networkId: isEvmNetwork ? undefined : selectedNetworkId,
                address: trimmedAddress,
              });
            isAllowed = !!addressBookItem;
          } catch {
            // ignore
          }
        }
        if (!isAllowed) {
          return intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_address_not_in_allowlist,
          });
        }
      }

      return true;
    },
    [
      intl,
      selectedNetworkId,
      network?.name,
      network?.id,
      isEnableTransferAllowList,
      setDuplicateAddressCount,
      selectorAccountItemsRef,
    ],
  );

  const debouncedValidate = useDebouncedValidation(handleValidateAddresses);

  return (
    <Form.Field
      name="receiverAddresses"
      label={intl.formatMessage({
        id: ETranslations.wallet_bulk_send_section_receiving_address,
      })}
      rules={{
        validate: debouncedValidate,
      }}
    >
      <LineNumberedTextArea
        singleLine
        showPaste
        showAccountSelector
        accountSelector={{
          num: 1,
          clearNotMatch: true,
        }}
        placeholder={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_placeholder_address,
        })}
        showLineNumbers={false}
        networkId={selectedNetworkId}
        accountId={selectedAccountId}
        onActiveAccountChange={handleActiveAccountChange}
      />
    </Form.Field>
  );
}

// ManyToMany: multi-line, address-only, with count matching validation
function ManyToManyReceiverInput({ maxLines }: { maxLines?: number }) {
  const intl = useIntl();
  const { selectedAccountId, selectedNetworkId, selectedToken } =
    useBulkSendAddressesInputContext();
  const { selectorAccountItemsRef, handleActiveAccountChange } =
    useReceiverSelectorAccountItems();

  const form = useFormContext();
  const senderAddresses = useWatch({
    control: form.control,
    name: 'senderAddresses',
  }) as string | undefined;
  const previousSenderAddressesRef = useRef<string | undefined>(undefined);

  const { handleValidateAddresses, errors } = useMultiLineAddressValidation({
    selectedNetworkId,
    selectedToken,
    maxLines,
    allowAmounts: true,
    requireAmounts: false,
    checkDuplicates: false,
    checkAllowlist: true,
    selectedAccountId,
    selectorAccountItemsRef,
  });

  const validate = useCallback(
    async (value: string) => {
      const result = await handleValidateAddresses(
        value,
        ETranslations.wallet_bulk_send_error_receiver_required,
      );

      // Check sender/receiver count match
      if (result === true && value) {
        const senderValue = form.getValues('senderAddresses') as string;
        const senderCount = senderValue
          ? senderValue.split('\n').filter((l: string) => l.trim()).length
          : 0;
        const receiverCount = value.split('\n').filter((l) => l.trim()).length;

        if (senderCount > 0 && senderCount !== receiverCount) {
          return intl.formatMessage(
            {
              id: ETranslations.wallet_bulk_send_error_sender_receiver_count_mismatch,
            },
            { senders: senderCount, receivers: receiverCount },
          );
        }
      }

      return result;
    },
    [handleValidateAddresses, form, intl],
  );

  const debouncedValidate = useDebouncedValidation(validate);

  useEffect(() => {
    const previousSenderAddresses = previousSenderAddressesRef.current;
    previousSenderAddressesRef.current = senderAddresses;

    if (previousSenderAddresses === undefined) {
      return;
    }

    if (previousSenderAddresses === senderAddresses) {
      return;
    }

    if (!form.getValues('receiverAddresses')) {
      return;
    }

    void form.trigger('receiverAddresses');
  }, [form, senderAddresses]);

  const warningMessages = useMemo(() => {
    const warnings = errors.filter(
      (e) => e.type === ELineAnnotationType.Warning,
    );
    if (warnings.length === 0) return null;
    return warnings
      .map((w) =>
        intl.formatMessage(
          { id: ETranslations.wallet_bulk_send_error_line_with_message },
          { lineNumber: w.lineNumber, message: w.message },
        ),
      )
      .join('\n');
  }, [errors, intl]);

  return (
    <YStack>
      <Form.Field
        name="receiverAddresses"
        label={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_label_receiving_addresses,
        })}
        description={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_label_receiving_desc,
        })}
        rules={{
          required: true,
          validate: platformEnv.isNativeAndroid ? validate : debouncedValidate,
        }}
      >
        <LineNumberedTextArea
          showPaste
          showUpload
          showAccountSelector
          accountSelector={{
            num: 1,
            clearNotMatch: true,
          }}
          placeholder={intl.formatMessage({
            id: ETranslations.wallet_bulk_send_placeholder_addresses,
          })}
          errors={errors}
          networkId={selectedNetworkId}
          accountId={selectedAccountId}
          onActiveAccountChange={handleActiveAccountChange}
        />
      </Form.Field>
      {warningMessages ? (
        <SizableText pt="$1.5" color="$textCaution" size="$bodyMd">
          {warningMessages}
        </SizableText>
      ) : null}
    </YStack>
  );
}

// OneToMany: multi-line, address-only or address+amount (auto-detect)
function OneToManyReceiverInput({ maxLines }: { maxLines?: number }) {
  const intl = useIntl();
  const {
    selectedAccountId,
    selectedNetworkId,
    selectedToken,
    setDuplicateAddressCount,
  } = useBulkSendAddressesInputContext();
  const { selectorAccountItemsRef, handleActiveAccountChange } =
    useReceiverSelectorAccountItems();

  const { handleValidateAddresses, errors } = useMultiLineAddressValidation({
    selectedNetworkId,
    selectedToken,
    maxLines,
    allowAmounts: true,
    requireAmounts: false,
    checkDuplicates: true,
    checkAllowlist: true,
    selectedAccountId,
    duplicateWarningMode: true,
    onDuplicateAddressCountChange: setDuplicateAddressCount,
    selectorAccountItemsRef,
  });

  const validate = useCallback(
    async (value: string) =>
      handleValidateAddresses(
        value,
        ETranslations.wallet_bulk_send_error_receiver_required,
      ),
    [handleValidateAddresses],
  );

  const debouncedValidate = useDebouncedValidation(validate);

  const warningMessages = useMemo(() => {
    const warnings = errors.filter(
      (e) => e.type === ELineAnnotationType.Warning,
    );
    if (warnings.length === 0) return null;
    return warnings
      .map((w) =>
        intl.formatMessage(
          { id: ETranslations.wallet_bulk_send_error_line_with_message },
          { lineNumber: w.lineNumber, message: w.message },
        ),
      )
      .join('\n');
  }, [errors, intl]);

  return (
    <YStack>
      <Form.Field
        name="receiverAddresses"
        label={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_label_receiving_addresses,
        })}
        rules={{
          required: true,
          validate: platformEnv.isNativeAndroid ? validate : debouncedValidate,
        }}
        description={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_label_receiving_desc,
        })}
      >
        <LineNumberedTextArea
          showPaste
          showUpload
          showAccountSelector
          accountSelector={{
            num: 1,
            clearNotMatch: true,
          }}
          placeholder={intl.formatMessage({
            id: ETranslations.wallet_bulk_send_placeholder_addresses,
          })}
          errors={errors}
          networkId={selectedNetworkId}
          accountId={selectedAccountId}
          onActiveAccountChange={handleActiveAccountChange}
        />
      </Form.Field>
      {warningMessages ? (
        <SizableText pt="$1.5" color="$textCaution" size="$bodyMd">
          {warningMessages}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function ReceiverAddressesInput({ maxLines }: IReceiverAddressesInputProps) {
  const { bulkSendMode } = useBulkSendAddressesInputContext();

  if (bulkSendMode === EBulkSendMode.ManyToOne) {
    return <SingleLineReceiverInput />;
  }

  if (bulkSendMode === EBulkSendMode.ManyToMany) {
    return <ManyToManyReceiverInput maxLines={maxLines} />;
  }

  return <OneToManyReceiverInput maxLines={maxLines} />;
}

export default ReceiverAddressesInput;
