/* eslint-disable no-continue */
import { useCallback, useState } from 'react';

import pLimit from 'p-limit';
import { useIntl } from 'react-intl';

import { Form } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useDebouncedValidation } from '@onekeyhq/kit/src/views/BulkSend/hooks/useDebouncedValidation';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';
import { EReceiverMode } from '@onekeyhq/shared/types/bulkSend';

import { useBulkSendAddressesInputContext } from '../Context';

import LineNumberedTextArea from './LineNumberedTextArea';

import type { ILineError } from './LineNumberedTextArea';

type IReceiverAddressesInputProps = {
  maxLines?: number;
};

function ReceiverAddressesInput({ maxLines }: IReceiverAddressesInputProps) {
  const intl = useIntl();
  const { selectedAccountId, selectedNetworkId, selectedToken } =
    useBulkSendAddressesInputContext();
  const { network } = useAccountData({ networkId: selectedNetworkId });

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
            { id: ETranslations.wallet_bulk_send_error_invalid_network_address },
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
        customErrorMessages: {
          zeroAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_amount_zero,
          }),
        },
      });

      if (!isValid && error) {
        return error;
      }

      return true;
    },
    [intl, selectedToken],
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
        setErrors([]);
        return intl.formatMessage({
          id: ETranslations.wallet_bulk_send_error_receiver_required,
        });
      }

      const lines = value.split('\n');
      const nonEmptyLines = lines.filter((l) => l.trim());
      const lineErrors: ILineError[] = [];

      // Check max lines limit (based on non-empty lines)
      if (maxLines && nonEmptyLines.length > maxLines) {
        lineErrors.push({
          lineNumber: -1,
          message: intl.formatMessage(
            { id: ETranslations.wallet_bulk_send_error_max_addresses },
            { max: maxLines, current: nonEmptyLines.length },
          ),
        });
        setErrors(lineErrors);
        return lineErrors[0].message;
      }

      let receiverMode: EReceiverMode | undefined;

      // Phase 1: Synchronous validation (format, amounts)
      // Collect addresses that need async validation
      const addressesToValidate: { index: number; address: string }[] = [];

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) {
          continue;
        }

        const currentLineMode = parseLineMode(line);

        // Set mode from first non-empty line
        if (receiverMode === undefined) {
          receiverMode = currentLineMode;
        }

        // Check if current line matches the established mode
        if (currentLineMode !== receiverMode) {
          lineErrors.push({
            lineNumber: i + 1,
            message:
              receiverMode === EReceiverMode.AddressOnly
                ? intl.formatMessage({
                    id: ETranslations.wallet_bulk_send_error_expected_address_only,
                  })
                : intl.formatMessage({
                    id: ETranslations.wallet_bulk_send_error_expected_address_amount,
                  }),
          });
          continue;
        }

        if (receiverMode === EReceiverMode.AddressOnly) {
          // Queue address for async validation (duplicate check moved to Phase 2)
          addressesToValidate.push({ index: i, address: line });
        } else {
          // AddressAndAmount mode
          const parts = line.split(',');
          if (parts.length !== 2) {
            lineErrors.push({
              lineNumber: i + 1,
              message: intl.formatMessage({
                id: ETranslations.wallet_bulk_send_error_invalid_format,
              }),
            });
            continue;
          }

          const [address, amount] = parts.map((p) => p.trim());

          // Queue address for async validation (duplicate check moved to Phase 2)
          addressesToValidate.push({ index: i, address });

          // Validate amount synchronously
          const amountValidationResult = validateAmount(amount);
          if (amountValidationResult !== true) {
            lineErrors.push({
              lineNumber: i + 1,
              message:
                typeof amountValidationResult === 'string'
                  ? amountValidationResult
                  : intl.formatMessage({
                      id: ETranslations.wallet_bulk_send_error_invalid_amount,
                    }),
            });
          }
        }
      }

      // Phase 2: Concurrent address validation with rate limiting and duplicate detection
      if (addressesToValidate.length > 0) {
        const limit = pLimit(10); // Max 10 concurrent validations
        const validationResults = await Promise.all(
          addressesToValidate.map(({ index, address }) =>
            limit(async () => {
              const result = await validateAddress(address);
              return { index, result };
            }),
          ),
        );

        // Collect validation errors and check for duplicates using normalized addresses
        const seenNormalizedAddresses = new Map<string, number>();
        for (const { index, result } of validationResults) {
          if (!result.isValid) {
            lineErrors.push({
              lineNumber: index + 1,
              message:
                'error' in result
                  ? result.error
                  : intl.formatMessage({
                      id: ETranslations.wallet_bulk_send_error_invalid_address,
                    }),
            });
          } else {
            // Use normalizedAddress from validation result for duplicate detection
            // This handles network-specific address normalization (e.g., Tron is case-sensitive)
            const normalizedAddress = result.normalizedAddress;
            const seenIndex = seenNormalizedAddresses.get(normalizedAddress);
            if (seenIndex !== undefined) {
              lineErrors.push({
                lineNumber: index + 1,
                message: intl.formatMessage(
                  { id: ETranslations.wallet_bulk_send_error_duplicate_address },
                  { line: seenIndex },
                ),
              });
            } else {
              seenNormalizedAddresses.set(normalizedAddress, index + 1);
            }
          }
        }

        // Sort errors by line number for consistent display
        lineErrors.sort((a, b) => a.lineNumber - b.lineNumber);
      }

      setErrors(lineErrors);
      if (lineErrors.length > 0) {
        const maxErrors = 5;
        const errorsToDisplay = lineErrors.slice(0, maxErrors);
        if (lineErrors.length > maxErrors) {
          errorsToDisplay.push({
            lineNumber: -1,
            message: intl.formatMessage(
              { id: ETranslations.wallet_bulk_send_error_more_errors },
              { count: lineErrors.length - maxErrors },
            ),
          });
        }
        return errorsToDisplay
          .map((error) =>
            error.lineNumber === -1
              ? error.message
              : `Line ${error.lineNumber}: ${error.message}`,
          )
          .join('\n');
      }
      return true;
    },
    [intl, maxLines, parseLineMode, validateAddress, validateAmount],
  );

  const debouncedValidateAddresses = useDebouncedValidation(
    handleValidateAddresses,
  );

  return (
    <Form.Field
      name="receiverAddresses"
      label={intl.formatMessage({
        id: ETranslations.wallet_bulk_send_label_receiving_addresses,
      })}
      rules={{
        required: true,
        validate: debouncedValidateAddresses,
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

export default ReceiverAddressesInput;
