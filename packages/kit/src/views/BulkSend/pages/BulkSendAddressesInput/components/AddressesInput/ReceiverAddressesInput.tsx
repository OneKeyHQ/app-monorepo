/* eslint-disable no-continue */
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Form, useFormContext } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDebouncedValidation } from '@onekeyhq/kit/src/views/BulkSend/hooks/useDebouncedValidation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

import { useBulkSendAddressesInputContext } from '../Context';

import LineNumberedTextArea from './LineNumberedTextArea';
import { useMultiLineAddressValidation } from './useMultiLineAddressValidation';

type IReceiverAddressesInputProps = {
  maxLines?: number;
};

// ManyToOne: single-line receiver input
function SingleLineReceiverInput() {
  const intl = useIntl();
  const { selectedAccountId, selectedNetworkId } =
    useBulkSendAddressesInputContext();
  const { network } = useAccountData({ networkId: selectedNetworkId });

  const { result: vaultSettings } = usePromiseResult(
    async () =>
      selectedNetworkId
        ? backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId: selectedNetworkId,
          })
        : undefined,
    [selectedNetworkId],
  );

  const minTransferAmount = useMemo(() => {
    if (!vaultSettings || !selectedToken) return '0';
    return selectedToken.isNative
      ? (vaultSettings.nativeMinTransferAmount ??
          vaultSettings.minTransferAmount ??
          '0')
      : (vaultSettings.minTransferAmount ?? '0');
  }, [vaultSettings, selectedToken]);

  const [errors, setErrors] = useState<ILineError[]>([]);

  const validateAddress = useCallback(
    async (
      address: string,
    ): Promise<{ isValid: false; error: string } | IAddressValidation> => {
      const result =
        await backgroundApiProxy.serviceValidator.localValidateAddress({
          networkId: selectedNetworkId ?? '',
          address: address.trim(),
        });
      if (!result.isValid) {
        return {
          isValid: false,
          error: intl.formatMessage(
            {
              id: ETranslations.wallet_bulk_send_error_invalid_network_address,
            },
            { network: network?.name ?? '' },
          ),
        };
      }
      return result;
    },
    [intl, selectedNetworkId, network?.name],
  );

  const validateAmount = useCallback(
    (amount: string): string | boolean => {
      if (!selectedToken) {
        return intl.formatMessage({
          id: ETranslations.wallet_bulk_send_error_token_not_selected,
        });
      }

      const { isValid, error } = validateTokenAmount({
        token: selectedToken,
        amount,
        allowZero: false,
        minAmount:
          minTransferAmount && minTransferAmount !== '0'
            ? minTransferAmount
            : undefined,
        customErrorMessages: {
          emptyAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_invalid_amount,
          }),
          invalidAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_invalid_amount,
          }),
          negativeAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_amount_zero,
          }),
          zeroAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_amount_zero,
          }),
          minAmount: intl.formatMessage(
            { id: ETranslations.send_error_minimum_amount },
            { amount: minTransferAmount, token: selectedToken.symbol },
          ),
          decimalPlaces: intl.formatMessage(
            {
              id: ETranslations.wallet_bulk_send_error_max_decimal_places,
            },
            { decimals: selectedToken.decimals },
          ),
        },
      });

      if (!isValid && error) {
        return error;
      }

      return true;
    },
    [intl, selectedToken, minTransferAmount],
  );

  const parseLineMode = useCallback(
    (line: string): EReceiverMode =>
      line.includes(',')
        ? EReceiverMode.AddressAndAmount
        : EReceiverMode.AddressOnly,
    [],
  );

  const handleValidateAddresses = useCallback(
    async (value: string) => {
      if (!value) {
        return intl.formatMessage({
          id: ETranslations.wallet_bulk_send_error_receiver_required,
        });
      }

      const result =
        await backgroundApiProxy.serviceValidator.localValidateAddress({
          networkId: selectedNetworkId ?? '',
          address: value.trim(),
        });

      if (!result.isValid) {
        return intl.formatMessage(
          {
            id: ETranslations.wallet_bulk_send_error_invalid_network_address,
          },
          { network: network?.name ?? '' },
        );
      }

      return true;
    },
    [intl, selectedNetworkId, network?.name],
  );

  const debouncedValidate = useDebouncedValidation(handleValidateAddress);

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
      />
    </Form.Field>
  );
}

// ManyToMany: multi-line, address-only, with count matching validation
function ManyToManyReceiverInput({ maxLines }: { maxLines?: number }) {
  const intl = useIntl();
  const { selectedAccountId, selectedNetworkId, selectedToken } =
    useBulkSendAddressesInputContext();

  const form = useFormContext();

  const { handleValidateAddresses, errors } = useMultiLineAddressValidation({
    selectedNetworkId,
    selectedToken,
    maxLines,
    allowAmounts: false,
    checkDuplicates: true,
    checkAllowlist: true,
    selectedAccountId,
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
          return `Sender and receiver count must match (senders: ${senderCount}, receivers: ${receiverCount})`;
        }
      }

      return result;
    },
    [handleValidateAddresses, form],
  );

  const debouncedValidate = useDebouncedValidation(validate);

  return (
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
      />
    </Form.Field>
  );
}

// OneToMany: multi-line, address-only or address+amount (auto-detect)
function OneToManyReceiverInput({ maxLines }: { maxLines?: number }) {
  const intl = useIntl();
  const { selectedAccountId, selectedNetworkId, selectedToken } =
    useBulkSendAddressesInputContext();

  const { handleValidateAddresses, errors } = useMultiLineAddressValidation({
    selectedNetworkId,
    selectedToken,
    maxLines,
    allowAmounts: true,
    requireAmounts: false,
    checkDuplicates: true,
    checkAllowlist: true,
    selectedAccountId,
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

  return (
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
      />
    </Form.Field>
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
