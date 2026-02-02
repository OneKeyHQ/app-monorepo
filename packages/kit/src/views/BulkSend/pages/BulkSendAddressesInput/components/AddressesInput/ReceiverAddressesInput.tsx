/* eslint-disable no-continue */
import { useCallback, useState } from 'react';

import pLimit from 'p-limit';

import { Form } from '@onekeyhq/components';
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
          error: `Not a valid ${network?.name ?? ''} address`,
        };
      }
      return result;
    },
    [selectedNetworkId, network?.name],
  );

  const validateAmount = useCallback(
    (amount: string): string | boolean => {
      if (!selectedToken) {
        return 'Token not selected';
      }

      const { isValid, error } = validateTokenAmount({
        token: selectedToken,
        amount,
        allowZero: false,
        customErrorMessages: {
          zeroAmount: 'Amount must be greater than 0',
        },
      });

      if (!isValid && error) {
        return error;
      }

      return true;
    },
    [selectedToken],
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
        return 'Receiver address(es) is required';
      }

      const lines = value.split('\n');
      const lineErrors: ILineError[] = [];

      // Check max lines limit
      if (maxLines && lines.length > maxLines) {
        lineErrors.push({
          lineNumber: -1,
          message: `Maximum ${maxLines} addresses allowed, currently ${lines.length}`,
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
                ? 'Expected address only format'
                : 'Expected address,amount format',
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
              message: 'Invalid format, expected: address,amount',
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
                  : 'Invalid amount',
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
              message: 'error' in result ? result.error : 'Invalid address',
            });
          } else {
            // Use normalizedAddress from validation result for duplicate detection
            // This handles network-specific address normalization (e.g., Tron is case-sensitive)
            const normalizedAddress = result.normalizedAddress;
            const seenIndex = seenNormalizedAddresses.get(normalizedAddress);
            if (seenIndex !== undefined) {
              lineErrors.push({
                lineNumber: index + 1,
                message: `Duplicate address (same as line ${seenIndex})`,
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
            message: `... and ${lineErrors.length - maxErrors} more errors`,
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
    [maxLines, parseLineMode, validateAddress, validateAmount],
  );

  const debouncedValidateAddresses = useDebouncedValidation(
    handleValidateAddresses,
  );

  return (
    <Form.Field
      name="receiverAddresses"
      label="Receiving Address(es)"
      rules={{
        required: true,
        validate: debouncedValidateAddresses,
      }}
      description="Supports: Address only OR Address, Amount"
    >
      <LineNumberedTextArea
        showPaste
        showUpload
        showAccountSelector
        accountSelector={{
          num: 1,
          clearNotMatch: true,
        }}
        placeholder="Enter addresses, one per line"
        height={120}
        errors={errors}
        networkId={selectedNetworkId}
        accountId={selectedAccountId}
      />
    </Form.Field>
  );
}

export default ReceiverAddressesInput;
