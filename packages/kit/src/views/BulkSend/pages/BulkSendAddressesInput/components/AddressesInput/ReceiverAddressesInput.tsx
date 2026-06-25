/* eslint-disable no-continue */
import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react';

import { useWatch } from 'react-hook-form';
import { useIntl } from 'react-intl';

import {
  Form,
  type IFieldErrorProps,
  SizableText,
  YStack,
  useFormContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { isAddressOwnedByDeactivatedBotWallet } from '@onekeyhq/kit/src/utils/botWalletAccountUtils';
import {
  getBotWalletDisabledMessage,
  showBotWalletDisabledToast,
} from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import { useDebouncedValidation } from '@onekeyhq/kit/src/views/BulkSend/hooks/useDebouncedValidation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

import { parseBulkSendAddressLine } from '../../addressLineUtils';
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

type IParsedAllowlistMessage =
  | {
      key: string;
      lineNumber: number;
    }
  | {
      key: string;
      message: string;
    };

const BULK_SEND_ALLOWLIST_ERROR_ID =
  ETranslations.wallet_bulk_send_error_address_not_in_allowlist;

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

function BulkSendReceiverAllowlistErrorMessage({ error }: IFieldErrorProps) {
  const form = useFormContext();
  const navigation = useAppNavigation();
  const {
    selectedAccountId,
    selectedNetworkId,
    receiverValidationErrors,
    setReceiverValidationErrors,
  } = useBulkSendAddressesInputContext();

  const handleAddressBookSaved = useCallback(() => {
    setReceiverValidationErrors([]);
    void form.trigger('receiverAddresses');
  }, [form, setReceiverValidationErrors]);

  const handleOpenAddressBook = useCallback(
    async (lineNumber?: number) => {
      const receiverAddresses =
        (form.getValues('receiverAddresses') as string | undefined) ?? '';
      const lines = receiverAddresses.split('\n');
      const targetLine =
        typeof lineNumber === 'number' ? lines[lineNumber - 1]?.trim() : '';
      const parsedLine = targetLine
        ? parseBulkSendAddressLine(targetLine)
        : undefined;
      const address = parsedLine?.isValid ? parsedLine.address : undefined;

      if (!address || !selectedNetworkId) {
        return;
      }

      const { addressBookId, isAllowListed } =
        await backgroundApiProxy.serviceAccountProfile.queryAddress({
          accountId: selectedAccountId,
          networkId: selectedNetworkId,
          address,
          enableAddressBook: true,
          enableWalletName: true,
          skipValidateAddress: true,
        });

      if (isAllowListed) {
        return;
      }

      navigation.pushModal(EModalRoutes.AddressBookModal, {
        screen: EModalAddressBookRoutes.EditItemModal,
        params: {
          id: addressBookId,
          address,
          networkId: selectedNetworkId,
          isAllowListed: true,
          onSaveSuccess: handleAddressBookSaved,
        },
      });
    },
    [
      form,
      handleAddressBookSaved,
      navigation,
      selectedAccountId,
      selectedNetworkId,
    ],
  );

  const parsedMessages = useMemo<IParsedAllowlistMessage[]>(() => {
    const blockingAllowlistErrors = receiverValidationErrors.filter(
      (item) =>
        item.translationId === ETranslations.send_address_not_allowlist_error &&
        item.lineNumber > 0,
    );

    if (blockingAllowlistErrors.length > 0) {
      return blockingAllowlistErrors.map((item) => ({
        key: `${item.lineNumber}`,
        lineNumber: item.lineNumber,
      }));
    }

    if (!error?.message) {
      return [];
    }

    return [
      {
        key: 'fallback',
        message: error.message,
      },
    ];
  }, [error?.message, receiverValidationErrors]);

  return (
    <>
      {parsedMessages.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 ? '\n' : null}
          {'lineNumber' in item ? (
            <HyperlinkText
              color="$textCritical"
              size="$bodyMd"
              translationId={ETranslations.send_address_not_allowlist_error}
              autoExecuteParsedAction={false}
              onAction={(actionId) => {
                if (actionId === 'to_add_address_page') {
                  void handleOpenAddressBook(item.lineNumber);
                }
              }}
            />
          ) : (
            <SizableText color="$textCritical" size="$bodyMd">
              {item.message}
            </SizableText>
          )}
        </Fragment>
      ))}
    </>
  );
}

const renderBulkSendReceiverAllowlistErrorMessage = (
  props: IFieldErrorProps,
) => <BulkSendReceiverAllowlistErrorMessage {...props} />;

function useReceiverSelectorAccountItems() {
  const selectorAccountItemsRef = useRef<
    Record<string, IBulkSendSelectorAccountItem>
  >({});

  const handleActiveAccountChange = useCallback(
    async (activeAccount: IAccountSelectorActiveAccountInfo) => {
      const walletId = activeAccount.wallet?.id;
      if (
        accountUtils.isBotWallet({ walletId }) &&
        walletId &&
        (await backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
          walletId,
        }))
      ) {
        showBotWalletDisabledToast('beReceiver');
        return false;
      }

      const selectorAccountItem =
        buildReceiverSelectorAccountItem(activeAccount);
      if (selectorAccountItem) {
        selectorAccountItemsRef.current[
          buildBulkSendSelectorAddressKey(selectorAccountItem.address)
        ] = selectorAccountItem;
        void backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
      }
      return true;
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
  const {
    selectedAccountId,
    selectedNetworkId,
    setDuplicateAddressCount,
    setReceiverValidationErrors,
  } = useBulkSendAddressesInputContext();
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
        setReceiverValidationErrors([]);
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
        setReceiverValidationErrors([]);
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

      // Reject when the receiver address resolves to a deactivated Bot Wallet
      // account. The helper falls back to BTC fresh-address resolution to
      // match the allowlist resolver below. Surface a toast in addition to
      // the inline error so users see the rejection prominently — the form
      // continues to block submission via the inline error.
      if (selectedNetworkId) {
        const isDeactivatedBotReceiver =
          await isAddressOwnedByDeactivatedBotWallet({
            networkId: selectedNetworkId,
            address: trimmedAddress,
          });
        if (isDeactivatedBotReceiver) {
          setReceiverValidationErrors([]);
          showBotWalletDisabledToast('beReceiver');
          return getBotWalletDisabledMessage('beReceiver');
        }
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
          setReceiverValidationErrors([
            {
              lineNumber: 1,
              message: intl.formatMessage({
                id: BULK_SEND_ALLOWLIST_ERROR_ID,
              }),
              translationId: ETranslations.send_address_not_allowlist_error,
            },
          ]);
          return intl.formatMessage({
            id: BULK_SEND_ALLOWLIST_ERROR_ID,
          });
        }
      }

      setReceiverValidationErrors([]);
      return true;
    },
    [
      intl,
      selectedNetworkId,
      network?.name,
      network?.id,
      isEnableTransferAllowList,
      setDuplicateAddressCount,
      setReceiverValidationErrors,
      selectorAccountItemsRef,
    ],
  );

  const debouncedValidation = useDebouncedValidation(handleValidateAddresses);

  return (
    <Form.Field
      name="receiverAddresses"
      label={intl.formatMessage({
        id: ETranslations.wallet_bulk_send_section_receiving_address,
      })}
      renderErrorMessage={renderBulkSendReceiverAllowlistErrorMessage}
      rules={{
        validate: debouncedValidation.validate,
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
  const {
    selectedAccountId,
    selectedNetworkId,
    selectedToken,
    setReceiverValidationErrors,
  } = useBulkSendAddressesInputContext();
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
    onErrorsChange: setReceiverValidationErrors,
    rejectDeactivatedBotWalletReceiver: true,
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

  const debouncedValidation = useDebouncedValidation(validate);

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
        renderErrorMessage={renderBulkSendReceiverAllowlistErrorMessage}
        rules={{
          required: true,
          validate: platformEnv.isNativeAndroid
            ? validate
            : debouncedValidation.validate,
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
    setReceiverValidationErrors,
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
    onErrorsChange: setReceiverValidationErrors,
    rejectDeactivatedBotWalletReceiver: true,
  });

  const validate = useCallback(
    async (value: string) =>
      handleValidateAddresses(
        value,
        ETranslations.wallet_bulk_send_error_receiver_required,
      ),
    [handleValidateAddresses],
  );

  const debouncedValidation = useDebouncedValidation(validate);

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
        renderErrorMessage={renderBulkSendReceiverAllowlistErrorMessage}
        rules={{
          required: true,
          validate: platformEnv.isNativeAndroid
            ? validate
            : debouncedValidation.validate,
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
