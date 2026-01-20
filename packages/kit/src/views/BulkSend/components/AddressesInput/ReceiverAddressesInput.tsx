/* eslint-disable no-continue */
import { useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { Form } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { EReceiverMode } from '@onekeyhq/shared/types/bulkSend';

import { useBulkSendContext } from '../BulkSendContext';

import LineNumberedTextArea from './LineNumberedTextArea';

import type { ILineError } from './LineNumberedTextArea';

function ReceiverAddressesInput() {
  const { selectedAccountId, selectedNetworkId, selectedToken } = useBulkSendContext();
  const { network } = useAccountData({ networkId: selectedNetworkId });

  const [errors, setErrors] = useState<ILineError[]>([]);

  const validateAddress = useCallback(
    async (address: string): Promise<string | boolean> => {
      const result =
        await backgroundApiProxy.serviceValidator.localValidateAddress({
          networkId: selectedNetworkId ?? '',
          address: address.trim(),
        });
      if (!result.isValid) {
        return `Not a valid ${network?.name ?? ''} address`;
      }
      return true;
    },
    [selectedNetworkId, network?.name],
  );

  const validateAmount = useCallback(
    (amount: string): string | boolean => {
      const amountBN = new BigNumber(amount);
      if (amountBN.isNaN()) {
        return 'Invalid amount';
      }

      if (amountBN.isNegative()) {
        return 'Amount must be greater than 0';
      }

      // check token decimals
      if (selectedToken && !isNil(selectedToken.decimals)) {
        const amountDecimals = amountBN.decimalPlaces();
        if (
          amountDecimals !== null &&
          amountDecimals > selectedToken.decimals
        ) {
          return `Amount must be less than or equal to ${selectedToken.decimals} decimal places`;
        }
      }

      return true;
    },
    [selectedToken],
  );

  const parseLineMode = useCallback((line: string): EReceiverMode => {
    // Check if line contains a comma (address,amount format)
    if (line.includes(',')) {
      return EReceiverMode.AddressAndAmount;
    }
    return EReceiverMode.AddressOnly;
  }, []);

  const handleValidateAddresses = useCallback(
    async (value: string) => {
      if (!value) {
        setErrors([]);
        return 'Receiver address(es) is required';
      }

      const lines = value.split('\n');
      const lineErrors: ILineError[] = [];
      const seenAddresses = new Map<string, number>();

      let receiverMode: EReceiverMode | undefined;

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
          // Check for duplicate address
          const normalizedAddress = line.toLowerCase();
          const seenAddressIndex = seenAddresses.get(normalizedAddress);
          if (seenAddressIndex !== undefined) {
            lineErrors.push({
              lineNumber: i + 1,
              message: `Duplicate address (same as line ${seenAddressIndex})`,
            });
            continue;
          }
          seenAddresses.set(normalizedAddress, i + 1);

          // Validate address only
          const addressValidationResult = await validateAddress(line);
          if (addressValidationResult !== true) {
            lineErrors.push({
              lineNumber: i + 1,
              message:
                typeof addressValidationResult === 'string'
                  ? addressValidationResult
                  : 'Invalid address',
            });
          }
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

          // Check for duplicate address
          const normalizedAddress = address.toLowerCase();
          const seenAddressIndex = seenAddresses.get(normalizedAddress);
          if (seenAddressIndex !== undefined) {
            lineErrors.push({
              lineNumber: i + 1,
              message: `Duplicate address (same as line ${seenAddressIndex})`,
            });
            continue;
          }
          seenAddresses.set(normalizedAddress, i + 1);

          const addressValidationResult = await validateAddress(address);
          if (addressValidationResult !== true) {
            lineErrors.push({
              lineNumber: i + 1,
              message:
                typeof addressValidationResult === 'string'
                  ? addressValidationResult
                  : 'Invalid address',
            });
          }
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
    [parseLineMode, validateAddress, validateAmount],
  );

  return (
    <Form.Field
      name="receiverAddresses"
      label="Receiving Address(es)"
      rules={{
        required: true,
        validate: handleValidateAddresses,
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
