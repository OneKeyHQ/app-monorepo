/* eslint-disable no-continue */
import { useCallback, useState } from 'react';

import pLimit from 'p-limit';
import { useIntl } from 'react-intl';

import { Form } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useDebouncedValidation } from '@onekeyhq/kit/src/views/BulkSend/hooks/useDebouncedValidation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';
import { EBulkSendMode, EReceiverMode } from '@onekeyhq/shared/types/bulkSend';

import { useBulkSendAddressesInputContext } from '../Context';

import LineNumberedTextArea from './LineNumberedTextArea';

import type { ILineError } from './LineNumberedTextArea';

type IReceiverAddressesInputProps = {
  maxLines?: number;
};

function ReceiverAddressesInput({ maxLines }: IReceiverAddressesInputProps) {
  const intl = useIntl();
  const { selectedAccountId, selectedNetworkId, selectedToken, bulkSendMode } =
    useBulkSendAddressesInputContext();
  const { network } = useAccountData({ networkId: selectedNetworkId });
  const isEnableTransferAllowList = useIsEnableTransferAllowList();

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
              return { index, address, result };
            }),
          ),
        );

        // Collect valid addresses for contract address detection
        const validAddresses: { index: number; address: string }[] = [];

        // Collect validation errors and check for duplicates using normalized addresses
        const seenNormalizedAddresses = new Map<string, number>();
        for (const { index, address, result } of validationResults) {
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
                  {
                    id: ETranslations.wallet_bulk_send_error_duplicate_address,
                  },
                  { line: seenIndex },
                ),
              });
            } else {
              seenNormalizedAddresses.set(normalizedAddress, index + 1);
              validAddresses.push({ index, address });
            }
          }
        }

        // Phase 3: Address risk detection + allowlist validation for valid, non-duplicate addresses
        if (validAddresses.length > 0 && selectedNetworkId) {
          // Allowlist validation — reject addresses not in address book or local wallets
          if (isEnableTransferAllowList) {
            const isEvmNetwork = networkUtils.isEvmNetwork({
              networkId: selectedNetworkId,
            });
            const isBTCNetwork = networkUtils.isBTCNetwork(selectedNetworkId);
            const allowListResults = await Promise.all(
              validAddresses.map(({ index, address }) =>
                limit(async () => {
                  const trimmedAddress = address.trim();

                  // Check if address belongs to user's own local wallet (HD/HW/QR/Imported)
                  try {
                    let walletAccountItems =
                      await backgroundApiProxy.serviceAccount.getAccountNameFromAddress(
                        {
                          networkId: selectedNetworkId,
                          address: trimmedAddress,
                        },
                      );

                    // For BTC networks, also check fresh addresses
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
                        accountUtils.isOwnAccount({
                          accountId: item.accountId,
                        }),
                      )
                    ) {
                      return { index, isAllowed: true };
                    }
                  } catch (e) {
                    // Wallet account lookup failed, continue to address book check
                    console.error(e);
                  }

                  // Check if address is in address book
                  try {
                    const addressBookItem =
                      await backgroundApiProxy.serviceAddressBook.dangerouslyFindItemWithoutSafeCheck(
                        {
                          networkId: isEvmNetwork
                            ? undefined
                            : selectedNetworkId,
                          address: trimmedAddress,
                        },
                      );
                    return {
                      index,
                      isAllowed: !!addressBookItem,
                    };
                  } catch (e) {
                    console.error(e);
                  }

                  return { index, isAllowed: false };
                }),
              ),
            );

            for (const { index, isAllowed } of allowListResults) {
              if (!isAllowed) {
                lineErrors.push({
                  lineNumber: index + 1,
                  message: intl.formatMessage({
                    id: ETranslations.wallet_bulk_send_error_address_not_in_allowlist,
                  }),
                });
              }
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
              : intl.formatMessage(
                  {
                    id: ETranslations.wallet_bulk_send_error_line_with_message,
                  },
                  {
                    lineNumber: error.lineNumber,
                    message: error.message,
                  },
                ),
          )
          .join('\n');
      }
      return true;
    },
    [
      intl,
      isEnableTransferAllowList,
      maxLines,
      parseLineMode,
      selectedNetworkId,
      validateAddress,
      validateAmount,
    ],
  );

  const debouncedValidateAddresses = useDebouncedValidation(
    handleValidateAddresses,
  );

  return (
    <Form.Field
      name="receiverAddresses"
      label={intl.formatMessage({
        id:
          bulkSendMode === EBulkSendMode.ManyToOne
            ? ETranslations.wallet_bulk_send_section_receiving_address
            : ETranslations.wallet_bulk_send_label_receiving_addresses,
      })}
      rules={{
        required: true,
        validate: platformEnv.isNativeAndroid
          ? handleValidateAddresses
          : debouncedValidateAddresses,
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
