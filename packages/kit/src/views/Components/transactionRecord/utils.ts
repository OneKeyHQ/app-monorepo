import { BigNumber } from 'bignumber.js';

import type { Transaction } from '@onekeyhq/engine/src/types/covalent';
import { EVMTxFromType } from '@onekeyhq/engine/src/types/covalent';
import type { Network } from '@onekeyhq/engine/src/types/network';
import { EVMDecodedTxType } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/types';

import { formatBalanceDisplay } from '../../../components/Format';

export type AmountBalance = {
  balance: BigNumber.Value | undefined;
  decimals: number;
  unit: string | null;
  fixed: number | undefined;
};

export type AmountFiatBalance = {
  balance: BigNumber.Value | undefined;
};

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export function getTransferNFTList(transaction: Transaction | null): string[] {
  if (
    transaction?.txType === EVMDecodedTxType.ERC721_TRANSFER &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // 721 transfer
    const tokenEvents = transaction?.tokenEvent?.filter(
      (event) => event.txType === EVMDecodedTxType.ERC721_TRANSFER,
    );
    const nftImages = tokenEvents
      ?.map((event) => event.tokenLogoUrl)
      .filter(notEmpty);

    return nftImages ?? [];
  }
  return [];
}

export function getSwapTransfer(
  transaction: Transaction | null,
  network?: Network | null | undefined,
): string {
  let amount;
  if (
    transaction?.txType === EVMDecodedTxType.SWAP &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // swap transfer
    const tokenEvent = transaction?.tokenEvent?.find(
      (event) => event.fromType === EVMTxFromType.OUT,
    );
    if (tokenEvent?.txType === EVMDecodedTxType.TOKEN_TRANSFER) {
      amount = formatBalanceDisplay(
        tokenEvent?.tokenAmount,
        tokenEvent?.tokenSymbol,
        {
          unit: tokenEvent?.tokenDecimals,
          fixed: network?.tokenDisplayDecimals,
        },
      );
    } else {
      amount = formatBalanceDisplay(
        transaction?.value,
        network?.symbol ?? 'ETH',
        {
          unit: network?.decimals ?? 18,
          fixed: network?.nativeDisplayDecimals,
        },
      );
    }
  }
  return `${amount?.amount ?? '0'}${amount?.unit ? ` ${amount?.unit}` : ''}`;
}

export function getSwapReceive(
  transaction: Transaction | null,
  network?: Network | null | undefined,
): string {
  let amount;
  if (
    transaction?.txType === EVMDecodedTxType.SWAP &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // swap transfer
    const tokenEvent = transaction?.tokenEvent?.find(
      (event) => event.fromType === EVMTxFromType.IN,
    );
    if (tokenEvent?.txType === EVMDecodedTxType.TOKEN_TRANSFER) {
      amount = formatBalanceDisplay(
        tokenEvent?.tokenAmount,
        tokenEvent?.tokenSymbol,
        {
          unit: tokenEvent?.tokenDecimals,
          fixed: network?.tokenDisplayDecimals,
        },
      );
    } else {
      amount = formatBalanceDisplay(
        transaction?.value,
        network?.symbol ?? 'ETH',
        {
          unit: network?.decimals ?? 18,
          fixed: network?.nativeDisplayDecimals,
        },
      );
    }
  }
  return `${amount?.amount ?? '0'}${amount?.unit ? ` ${amount?.unit}` : ''}`;
}

export function getTransferAmount(
  transaction: Transaction | null,
  network?: Network | null | undefined,
): AmountBalance {
  let amount;
  let decimals = 1;
  let unit = null;
  let fixed;

  if (
    transaction?.txType === EVMDecodedTxType.TOKEN_TRANSFER &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // token transfer
    const tokenEvent = transaction?.tokenEvent[0];
    amount = tokenEvent?.tokenAmount;
    decimals = tokenEvent?.tokenDecimals ?? 1;
    unit = tokenEvent?.tokenSymbol;
    fixed = network?.tokenDisplayDecimals;
  } else if (
    transaction?.txType === EVMDecodedTxType.ERC721_TRANSFER &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // 721 transfer
    const tokenEvents = transaction?.tokenEvent?.filter(
      (event) => event.txType === EVMDecodedTxType.ERC721_TRANSFER,
    );
    const tokenSize = tokenEvents?.length ?? 0;
    const tokenSymbol = tokenEvents[0]?.tokenSymbol ?? '';
    amount = tokenSize;
    decimals = 0;
    unit = tokenSymbol;
    fixed = network?.tokenDisplayDecimals;
  } else {
    amount = transaction?.value;
    decimals = network?.decimals ?? 18;
    unit = network?.symbol ?? 'ETH';
    fixed = network?.nativeDisplayDecimals;
  }
  return {
    balance: amount,
    decimals,
    unit,
    fixed,
  };
}

export function getTransferAmountFiat(
  transaction: Transaction,
): AmountFiatBalance {
  let amountFiat;
  if (
    transaction?.txType === EVMDecodedTxType.ERC721_TRANSFER &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    amountFiat = 0;
  } else if (
    transaction?.txType === EVMDecodedTxType.TOKEN_TRANSFER &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // token transfer
    const tokenEvent = transaction?.tokenEvent[0];

    amountFiat = new BigNumber(tokenEvent?.deltaQuote ?? '0').plus(
      new BigNumber(transaction?.valueQuote ?? '0').decimalPlaces(2),
    );
  } else {
    amountFiat = new BigNumber(transaction?.valueQuote ?? '0').decimalPlaces(2);
  }
  return { balance: amountFiat };
}

export function getFromAddress(transaction: Transaction | null) {
  let fromAddress: string = transaction?.fromAddress ?? '';
  let fromAddressLabel: string | null = transaction?.fromAddressLabel ?? '';
  if (
    transaction?.txType === EVMDecodedTxType.TOKEN_TRANSFER &&
    transaction.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    fromAddress = transaction.tokenEvent[0].fromAddress;
    fromAddressLabel = transaction.tokenEvent[0].fromAddressLabel;
  }
  return { fromAddress, fromAddressLabel };
}

export function getToAddress(transaction: Transaction | null) {
  let toAddress: string = transaction?.toAddress ?? '';
  let toAddressLabel: string | null = transaction?.toAddressLabel ?? '';
  if (
    transaction?.txType === EVMDecodedTxType.TOKEN_TRANSFER &&
    transaction.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    toAddress = transaction.tokenEvent[0].toAddress;
    toAddressLabel = transaction.tokenEvent[0].toAddressLabel;
  }
  return { toAddress, toAddressLabel };
}
