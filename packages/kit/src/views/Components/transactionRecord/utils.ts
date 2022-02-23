import { BigNumber } from 'bignumber.js';

import {
  TokenType,
  Transaction,
  TransactionType,
} from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';

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

export function getTransferNFTList(transaction: Transaction | null): string[] {
  if (
    transaction?.tokenType === TokenType.ERC721 &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // 721 transfer
    const tokenEvents = transaction?.tokenEvent?.filter(
      (event) => event.tokenType === TokenType.ERC721,
    );
    const sss = tokenEvents?.map((event) => event.tokenLogoUrl);
    return sss;
  }
  return [];
}

export function getSwapTransfer(
  transaction: Transaction | null,
  network?: Network | null | undefined,
): string {
  let amount = '0';
  if (
    transaction?.type === TransactionType.Swap &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // swap transfer
    const tokenEvent = transaction?.tokenEvent?.find(
      (event) => event.transferType === TransactionType.Transfer,
    );
    if (tokenEvent?.tokenType === TokenType.ERC20) {
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
  return amount;
}

export function getSwapReceive(
  transaction: Transaction | null,
  network?: Network | null | undefined,
): string {
  let amount = '0';
  if (
    transaction?.type === TransactionType.Swap &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // swap transfer
    const tokenEvent = transaction?.tokenEvent?.find(
      (event) => event.transferType === TransactionType.Receive,
    );
    if (tokenEvent?.tokenType === TokenType.ERC20) {
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
  return amount;
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
    transaction?.tokenType === TokenType.ERC20 &&
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
    transaction?.tokenType === TokenType.ERC721 &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    // 721 transfer
    const tokenEvents = transaction?.tokenEvent?.filter(
      (event) => event.tokenType === TokenType.ERC721,
    );
    const tokenSize = tokenEvents?.length ?? 0;
    const tokenSymbol = tokenEvents[0]?.tokenSymbol ?? '';
    amount = tokenSize;
    decimals = 1;
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
    transaction?.tokenType === TokenType.ERC721 &&
    transaction?.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    amountFiat = 0;
  } else if (
    transaction?.tokenType === TokenType.ERC20 &&
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
    transaction?.tokenType === TokenType.ERC20 &&
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
    transaction?.tokenType === TokenType.ERC20 &&
    transaction.tokenEvent &&
    transaction.tokenEvent.length > 0
  ) {
    toAddress = transaction.tokenEvent[0].toAddress;
    toAddressLabel = transaction.tokenEvent[0].toAddressLabel;
  }
  return { toAddress, toAddressLabel };
}
