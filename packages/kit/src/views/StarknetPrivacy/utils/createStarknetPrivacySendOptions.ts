import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { ISendInputOptions } from '@onekeyhq/shared/src/routes/send';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import {
  EStrk20ErrorCode,
  EStrk20SequencingStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20TransferKind } from '@onekeyhq/shared/types/starknetPrivacy';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  formatMockMessage,
  getStarknetPrivacyAmountError,
  getStarknetPrivacyBalanceDisplay,
} from './starknetPrivacyUtils';

import type { IntlShape } from 'react-intl';

export function createStarknetPrivacySendOptions({
  intl,
  networkId,
  accountId,
  token,
  kind,
}: {
  intl: IntlShape;
  networkId: string;
  accountId: string;
  token: IToken;
  kind: IStrk20TransferKind;
}): ISendInputOptions {
  const service = backgroundApiProxy.serviceStarknetPrivacy;
  const account = { networkId, accountId };
  const getPreparationError = (error: unknown) =>
    errorUtils.isErrorByClassName({
      error,
      className: [EOneKeyErrorClassNames.PasswordPromptDialogCancel],
    })
      ? undefined
      : formatMockMessage(intl, mapStrk20Error(error).translationKey);

  return {
    validateRecipient:
      kind === 'transfer'
        ? async (recipient) => {
            try {
              if (await service.isRecipientRegistered({ networkId, recipient }))
                return;
              return formatMockMessage(
                intl,
                ETranslationsMock.starknet_privacy_error_recipient_not_registered,
              );
            } catch (error) {
              return getPreparationError(error);
            }
          }
        : undefined,
    amount: {
      // A native deposit shares its public balance with proof-dependent fees.
      allowMax: kind !== 'deposit' || !token.isNative,
      loadBalance:
        kind === 'deposit'
          ? undefined
          : async ({ allowPrompt }) => {
              try {
                const balances = await service.refreshPrivateBalances({
                  ...account,
                  tokenAddresses: [token.address],
                  allowPrompt,
                });
                return {
                  available: getStarknetPrivacyBalanceDisplay({
                    balances,
                    tokenAddress: token.address,
                    decimals: token.decimals,
                  }).privateBalanceParsed,
                };
              } catch (error) {
                const { code } = mapStrk20Error(error);
                return {
                  retryLabel: intl.formatMessage({
                    id:
                      code === EStrk20ErrorCode.Locked ||
                      errorUtils.isErrorByClassName({
                        error,
                        className: [
                          EOneKeyErrorClassNames.PasswordPromptDialogCancel,
                        ],
                      })
                        ? ETranslations.privacy_balance_verify__action
                        : ETranslations.global_retry,
                  }),
                };
              }
            },
      validate: ({ amount, balance, decimals }) => {
        const key = getStarknetPrivacyAmountError({
          amount,
          balance,
          decimals,
        });
        return key
          ? formatMockMessage(intl, key, { decimals: decimals ?? 0 })
          : undefined;
      },
      prepareTransaction: async ({ amount, recipientAddress, decimals }) => {
        const sequencing = await service.getSequencingState(account);
        if (sequencing.status !== EStrk20SequencingStatus.Ready) {
          throw new OneKeyLocalError({
            data: {
              starknetPrivacyErrorCode:
                sequencing.status === EStrk20SequencingStatus.Unavailable
                  ? EStrk20ErrorCode.Unavailable
                  : EStrk20ErrorCode.Waiting,
            },
          });
        }
        const { unsignedTx } = await service.buildPrivateTransferTx({
          ...account,
          kind,
          tokenAddress: token.address,
          amount: new BigNumber(amount).shiftedBy(decimals).toFixed(0),
          recipient: kind === 'transfer' ? recipientAddress : undefined,
        });
        return unsignedTx;
      },
      getPreparationError,
    },
  };
}
