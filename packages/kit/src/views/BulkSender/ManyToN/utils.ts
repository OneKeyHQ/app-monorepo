import BigNumber from 'bignumber.js';

import { ToastManager } from '@onekeyhq/components';
import { OneKeyError } from '@onekeyhq/engine/src/errors';
import type { Account } from '@onekeyhq/engine/src/types/account';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
  getSelectedFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { removeTrailingZeros } from '../../../utils/helper';
import { AmountTypeEnum, IntervalTypeEnum } from '../types';

import type { TokenTrader, TraderError } from '../types';
import type { IntlShape } from 'react-intl';

const randomBetween = ({
  min,
  max,
  decimals,
  randomDecimals = 2,
}: {
  min: string;
  max: string;
  decimals: number;
  randomDecimals?: number;
}) => {
  const minBN = new BigNumber(min);
  const maxBN = new BigNumber(max);

  if (minBN.isGreaterThan(maxBN)) {
    throw new OneKeyError('Min must be less than or equal to max');
  }
  const difference = maxBN.minus(minBN);
  const random = BigNumber.random(randomDecimals);
  return minBN.plus(difference.multipliedBy(random)).toFixed(decimals);
};

export const getTransferAmount = async ({
  networkId,
  senderItem,
  amount,
  amountType,
  token,
  tokensBalance,
}: {
  networkId: string;
  senderItem: TokenTrader;
  amount: string[];
  amountType: AmountTypeEnum;
  token: Token;
  tokensBalance: Record<string, string | undefined> | undefined;
}) => {
  if (amountType === AmountTypeEnum.Custom) {
    return senderItem.Amount!;
  }

  if (amountType === AmountTypeEnum.Fixed) {
    return amount[0];
  }

  // senderAccount has be verified in verifyBulkTransferBeforeConfirm
  // so here senderAccount must be not null
  const senderAccount =
    (await backgroundApiProxy.serviceAccount.getAccountByAddress({
      address: senderItem.Address,
      networkId,
    })) as Account;

  const senderTokenBalance = tokensBalance?.[senderAccount?.id] ?? '0';

  if (amountType === AmountTypeEnum.Random) {
    const min = amount[0];
    const max = BigNumber.min(senderTokenBalance, amount[1]).toFixed();
    return removeTrailingZeros(
      randomBetween({ min, max, decimals: token.decimals }),
    );
  }

  if (amountType === AmountTypeEnum.All) {
    return senderTokenBalance;
  }

  return '0';
};

export const getTxInterval = ({
  txInterval,
  intervalType,
}: {
  txInterval: string[];
  intervalType: IntervalTypeEnum;
}) => {
  if (intervalType === IntervalTypeEnum.Fixed) {
    return txInterval[0];
  }

  if (intervalType === IntervalTypeEnum.Random) {
    return randomBetween({
      min: txInterval[0],
      max: txInterval[1],
      decimals: 1,
    });
  }
};

export const verifyBulkTransferBeforeConfirm = async ({
  networkId,
  walletId,
  sender,
  receiver,
  bulkType,
  amount,
  amountType,
  token,
  nativeToken,
  feePresetIndex,
  intl,
  wallets,
}: {
  networkId: string;
  walletId: string;
  sender: TokenTrader[];
  receiver: TokenTrader[];
  bulkType: BulkTypeEnum;
  amount: string[];
  amountType: AmountTypeEnum;
  token: Token;
  nativeToken: Token | undefined | null;
  feePresetIndex: string;
  intl: IntlShape;
  wallets: Wallet[];
}) => {
  if (
    bulkType === BulkTypeEnum.ManyToMany &&
    receiver.length !== sender.length
  ) {
    const errors: TraderError[] = [
      {
        message: intl.formatMessage({
          id: 'msg__inconsistency_between_the_number_of_sender_and_recipient_addresses',
        }),
      },
    ];

    return {
      isVerified: false,
      errors,
    };
  }

  const errors: TraderError[] = [];
  const senderAccounts: {
    accountId: string;
    walletId: string;
  }[] = [];
  let feeInfo = null;
  let totalFeeNative = '0';
  const senderSet = new Set();
  for (let i = 0; i < sender.length; i += 1) {
    const senderItem = sender[i];
    const senderAccount =
      await backgroundApiProxy.serviceAccount.getAccountByAddress({
        address: senderItem.Address.toLowerCase(),
        networkId,
      });

    if (senderSet.has(senderItem.Address)) {
      errors.push({
        lineNumber: i + 1,
        message: intl.formatMessage({ id: 'msg__duplicated_address' }),
      });
    } else if (
      !senderAccount ||
      senderAccount.id.startsWith('watching-') ||
      senderAccount.id.startsWith('external-')
    ) {
      errors.push({
        lineNumber: i + 1,
        message: intl.formatMessage({ id: 'msg__you_dont_own_this_address' }),
      });
    } else {
      const wallet = wallets.find((item) =>
        item.accounts.includes(senderAccount?.id),
      );

      if (!wallet) {
        errors.push({
          lineNumber: i + 1,
          message: intl.formatMessage({ id: 'msg__you_dont_own_this_address' }),
        });
      } else {
        senderAccounts.push({
          accountId: senderAccount.id,
          walletId: wallet.id,
        });
        senderSet.add(senderItem.Address);
        if (feeInfo === null) {
          try {
            const encodedTxForEstimateFee =
              await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
                networkId,
                accountId: senderAccount.id,
                transferInfo: {
                  from: senderItem.Address,
                  to: receiver[0].Address,
                  amount: new BigNumber(1).shiftedBy(-token.decimals).toFixed(),
                  token: token.tokenIdOnNetwork,
                },
              });

            feeInfo = await backgroundApiProxy.engine.fetchFeeInfo({
              networkId,
              accountId: senderAccount.id,
              encodedTx: encodedTxForEstimateFee,
            });

            feeInfo.defaultPresetIndex = feePresetIndex;
            if (
              parseFloat(feeInfo.defaultPresetIndex) >
              feeInfo.prices.length - 1
            ) {
              feeInfo.defaultPresetIndex = `${feeInfo.prices.length - 1}`;
            }
            if (parseFloat(feeInfo.defaultPresetIndex) < 0) {
              feeInfo.defaultPresetIndex = '0';
            }

            const currentInfoUnit = getSelectedFeeInfoUnit({
              info: feeInfo,
              index: feeInfo.defaultPresetIndex,
            });

            const feeRange = calculateTotalFeeRange(currentInfoUnit);
            const total = feeRange.max;
            // use 2 times of the fee as the total fee to make sure the tx can be sent
            totalFeeNative = new BigNumber(
              calculateTotalFeeNative({
                amount: total,
                info: feeInfo,
              }),
            )
              .times(2)
              .toFixed();
          } catch {
            ToastManager.show(
              {
                title: intl.formatMessage({
                  id: 'msg__failed_to_get_network_fees_please_try_again',
                }),
              },
              {
                type: 'error',
              },
            );
            return {
              isVerified: false,
            };
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      isVerified: false,
      errors,
    };
  }

  const nativeTokensBalance =
    await backgroundApiProxy.serviceToken.batchFetchAccountBalances({
      walletId,
      networkId,
      accountIds: senderAccounts.map((item) => item.accountId),
      disableDebounce: true,
    });

  const tokensBalance = token.isNative
    ? nativeTokensBalance
    : await backgroundApiProxy.serviceToken.batchFetchAccountTokenBalances({
        walletId,
        networkId,
        accountIds: senderAccounts.map((item) => item.accountId),
        tokenAddress: token.tokenIdOnNetwork ?? token.address,
      });
  for (let i = 0; i < sender.length; i += 1) {
    let senderAmount = '0';
    const senderItem = sender[i];
    const senderAccountId = senderAccounts[i].accountId;

    if (amountType === AmountTypeEnum.Custom) {
      senderAmount = senderItem.Amount!;
    } else if (amountType === AmountTypeEnum.Fixed) {
      [senderAmount] = amount;
    } else if (amountType === AmountTypeEnum.Random) {
      [senderAmount] = amount;
    } else {
      senderAmount = '0';
    }

    const senderNativeTokenBalance =
      nativeTokensBalance?.[senderAccountId] ?? '0';
    const senderTokenBalance = tokensBalance?.[senderAccountId] ?? '0';

    if (token.isNative) {
      if (new BigNumber(senderAmount).gt(senderNativeTokenBalance)) {
        errors.push({
          lineNumber: i + 1,
          message: intl.formatMessage(
            {
              id: 'msg__insufficient_balance_available_amount_str_str',
            },
            {
              amount: senderNativeTokenBalance,
              symbol: token.symbol,
            },
          ),
        });
      } else if (
        new BigNumber(senderAmount)
          .plus(totalFeeNative)
          .gt(senderNativeTokenBalance)
      ) {
        errors.push({
          lineNumber: i + 1,
          message: intl.formatMessage(
            {
              id: 'msg__insufficient_native_token_for_network_fees_available_amount_str_str',
            },
            {
              amount: senderNativeTokenBalance,
              symbol: token.symbol,
            },
          ),
        });
      }
    } else {
      if (new BigNumber(senderAmount).gt(senderTokenBalance)) {
        errors.push({
          lineNumber: i + 1,
          message: intl.formatMessage(
            {
              id: 'msg__insufficient_balance_available_amount_str_str',
            },
            {
              amount: senderTokenBalance,
              symbol: token.symbol,
            },
          ),
        });
      }
      if (new BigNumber(totalFeeNative).gt(senderNativeTokenBalance)) {
        errors.push({
          lineNumber: i + 1,
          message: intl.formatMessage(
            {
              id: 'msg__insufficient_native_token_for_network_fees_available_amount_str_str',
            },
            {
              amount: senderNativeTokenBalance,
              symbol: nativeToken?.symbol ?? '',
            },
          ),
        });
      }
    }
  }

  if (errors.length > 0) {
    return {
      isVerified: false,
      errors,
    };
  }

  return {
    isVerified: true,
    senderAccounts,
    tokensBalance,
  };
};
