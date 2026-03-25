/* eslint-disable no-continue */
import { useCallback, useRef, useState } from 'react';

import pLimit from 'p-limit';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';
import { EReceiverMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { ILineError } from './LineNumberedTextArea';

type IUseMultiLineAddressValidationParams = {
  selectedNetworkId: string | undefined;
  selectedToken: IToken | undefined;
  maxLines?: number;
  allowAmounts: boolean;
  requireAmounts?: boolean;
  checkDuplicates: boolean;
  checkAllowlist: boolean;
  selectedAccountId?: string;
  resolveAccountId?: boolean;
  onResolvedAccountIds?: (ids: Record<number, string>) => void;
};

function useMultiLineAddressValidation(
  params: IUseMultiLineAddressValidationParams,
) {
  const {
    selectedNetworkId,
    selectedToken,
    maxLines,
    allowAmounts,
    requireAmounts,
    checkDuplicates,
    checkAllowlist,
    // selectedAccountId reserved for future allowlist context
    selectedAccountId: _selectedAccountId,
    resolveAccountId,
    onResolvedAccountIds,
  } = params;

  const intl = useIntl();
  const { network } = useAccountData({ networkId: selectedNetworkId });
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const onResolvedAccountIdsRef = useRef(onResolvedAccountIds);
  onResolvedAccountIdsRef.current = onResolvedAccountIds;

  const { result: vaultSettings } = usePromiseResult(
    async () =>
      selectedNetworkId
        ? backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId: selectedNetworkId,
          })
        : undefined,
    [selectedNetworkId],
  );

  let minTransferAmount = '0';
  if (vaultSettings && selectedToken) {
    if (selectedToken.isNative) {
      minTransferAmount =
        vaultSettings.nativeMinTransferAmount ??
        vaultSettings.minTransferAmount ??
        '0';
    } else {
      minTransferAmount = vaultSettings.minTransferAmount ?? '0';
    }
  }

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

  const resolveAccountIdForAddress = useCallback(
    async (
      address: string,
      networkId: string,
    ): Promise<{ accountId: string } | { error: string }> => {
      try {
        const walletAccountItems =
          await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
            networkId,
            address: address.trim(),
          });

        if (walletAccountItems.length === 0) {
          return {
            error: intl.formatMessage({
              id: ETranslations.wallet_bulk_send_error_address_not_found,
            }),
          };
        }

        for (const item of walletAccountItems) {
          if (accountUtils.isWatchingAccount({ accountId: item.accountId })) {
            continue;
          }

          if (
            accountUtils.isHdAccount({ accountId: item.accountId }) ||
            accountUtils.isHwAccount({ accountId: item.accountId })
          ) {
            const networkAccounts =
              await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
                {
                  indexedAccountId: item.accountId,
                  networkIds: [networkId],
                },
              );
            if (networkAccounts[0]?.account) {
              return { accountId: networkAccounts[0].account.id };
            }
          } else if (
            accountUtils.isExternalAccount({ accountId: item.accountId }) ||
            accountUtils.isImportedAccount({ accountId: item.accountId })
          ) {
            return { accountId: item.accountId };
          }
        }

        // All matched accounts are watching accounts
        return {
          error: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_watching_account,
          }),
        };
      } catch (_) {
        return {
          error: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_address_not_found,
          }),
        };
      }
    },
    [intl],
  );

  const handleValidateAddresses = useCallback(
    async (value: string, emptyErrorMessageId: ETranslations) => {
      if (!value) {
        setErrors([]);
        if (resolveAccountId) {
          onResolvedAccountIdsRef.current?.({});
        }
        return intl.formatMessage({ id: emptyErrorMessageId });
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
      const addressesToValidate: { index: number; address: string }[] = [];

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();

        if (!line) {
          continue;
        }

        const currentLineMode = parseLineMode(line);

        // Determine expected mode based on params
        if (receiverMode === undefined) {
          if (!allowAmounts) {
            // Force address-only mode
            receiverMode = EReceiverMode.AddressOnly;
          } else if (requireAmounts) {
            // Force address+amount mode
            receiverMode = EReceiverMode.AddressAndAmount;
          } else {
            // Auto-detect from first line
            receiverMode = currentLineMode;
          }
        }

        // If amounts are not allowed but line has a comma, reject
        if (
          !allowAmounts &&
          currentLineMode === EReceiverMode.AddressAndAmount
        ) {
          lineErrors.push({
            lineNumber: i + 1,
            message: intl.formatMessage({
              id: ETranslations.wallet_bulk_send_error_expected_address_only,
            }),
          });
          continue;
        }

        // If amounts are required but line has no comma, reject
        if (requireAmounts && currentLineMode === EReceiverMode.AddressOnly) {
          lineErrors.push({
            lineNumber: i + 1,
            message: intl.formatMessage({
              id: ETranslations.wallet_bulk_send_error_expected_address_amount,
            }),
          });
          continue;
        }

        // Check if current line matches the established mode (for auto-detect)
        if (
          !requireAmounts &&
          allowAmounts &&
          currentLineMode !== receiverMode
        ) {
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

        if (currentLineMode === EReceiverMode.AddressOnly) {
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
      const resolvedIds: Record<number, string> = {};

      if (addressesToValidate.length > 0) {
        const limit = pLimit(10);
        const validationResults = await Promise.all(
          addressesToValidate.map(({ index, address }) =>
            limit(async () => {
              const result = await validateAddress(address);
              return { index, address, result };
            }),
          ),
        );

        const validAddresses: { index: number; address: string }[] = [];
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
            const normalizedAddress = result.normalizedAddress;

            if (checkDuplicates) {
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
            } else {
              validAddresses.push({ index, address });
            }
          }
        }

        // Phase 2.5: Resolve accountId for each valid sender address
        if (
          resolveAccountId &&
          validAddresses.length > 0 &&
          selectedNetworkId
        ) {
          const accountIdResults = await Promise.all(
            validAddresses.map(({ index, address }) =>
              limit(async () => {
                const result = await resolveAccountIdForAddress(
                  address,
                  selectedNetworkId,
                );
                return { index, result };
              }),
            ),
          );

          for (const { index, result } of accountIdResults) {
            if ('error' in result) {
              lineErrors.push({
                lineNumber: index + 1,
                message: result.error,
              });
            } else {
              // Map from original line index to accountId
              // Need to convert from lines[] index to non-empty line index
              let nonEmptyIndex = 0;
              for (let i = 0; i <= index; i += 1) {
                if (lines[i].trim()) {
                  if (i === index) {
                    resolvedIds[nonEmptyIndex] = result.accountId;
                  }
                  nonEmptyIndex += 1;
                }
              }
            }
          }
        }

        // Phase 3: Allowlist validation for valid, non-duplicate addresses
        if (
          checkAllowlist &&
          validAddresses.length > 0 &&
          selectedNetworkId &&
          isEnableTransferAllowList
        ) {
          const isEvmNetwork = networkUtils.isEvmNetwork({
            networkId: selectedNetworkId,
          });
          const isBTCNetwork = networkUtils.isBTCNetwork(selectedNetworkId);
          const allowListResults = await Promise.all(
            validAddresses.map(({ index, address }) =>
              limit(async () => {
                const trimmedAddress = address.trim();

                try {
                  let walletAccountItems =
                    await backgroundApiProxy.serviceAccount.getAccountNameFromAddress(
                      {
                        networkId: selectedNetworkId,
                        address: trimmedAddress,
                      },
                    );

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
                  console.error(e);
                }

                try {
                  const addressBookItem =
                    await backgroundApiProxy.serviceAddressBook.dangerouslyFindItemWithoutSafeCheck(
                      {
                        networkId: isEvmNetwork ? undefined : selectedNetworkId,
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

        lineErrors.sort((a, b) => a.lineNumber - b.lineNumber);
      }

      // Notify parent of resolved accountIds
      if (resolveAccountId) {
        onResolvedAccountIdsRef.current?.(resolvedIds);
      }

      setErrors(lineErrors);
      if (lineErrors.length > 0) {
        const maxErrorsToDisplay = 5;
        const errorsToDisplay = lineErrors.slice(0, maxErrorsToDisplay);
        if (lineErrors.length > maxErrorsToDisplay) {
          errorsToDisplay.push({
            lineNumber: -1,
            message: intl.formatMessage(
              { id: ETranslations.wallet_bulk_send_error_more_errors },
              { count: lineErrors.length - maxErrorsToDisplay },
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
      allowAmounts,
      requireAmounts,
      checkDuplicates,
      checkAllowlist,
      resolveAccountId,
      resolveAccountIdForAddress,
    ],
  );

  return {
    handleValidateAddresses,
    errors,
    validateAddress,
  };
}

export { useMultiLineAddressValidation };
