import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

import { HYPERLIQUID_DEPOSIT_ADDRESS } from '../../types/hyperliquid/perp.constants';

import type { IInternalTransferToken } from '../../types/hyperliquid/internalTransfer';
import type {
  ISpotClearinghouseStateResponse,
  ISpotMetaAndAssetCtxsResponse,
  IUserNonFundingLedgerUpdate,
} from '../../types/hyperliquid/sdk';

// Hyperliquid Send tokens exclusions, including Unit treasuries (2026-11-03).
// shortcut: static bridge destinations; add operation-based exclusions when integrating Unit withdrawals.
const internalTransferBridgeAddresses = new Set([
  '0x2222222222222222222222222222222222222222',
  '0x865eb9baa5492cef598adf7afb1038654fcb7081',
  '0x66cf0aace1b4e562593bec10ec7868fba9932224',
  '0xf70da97812cb96acdf810712aa562db8dfa3dbef',
  '0x1c498a93b145e7a73d69691e9023f6f308e1cc3f',
  '0x8d68efbf06fb8cf932518bcb53705e674c4852dc',
  '0x574bafce69d9411f662a433896e74e4f153096fa',
  '0x8dafbe89302656a7df43c470e9ebcb4c540835c0',
  '0x1f6093d33db935b2ebd81d23312da5f11759973e',
  '0xa822a9ceb6d6cb5b565bd10098abcfa9cf18d748',
  '0xe6111266afdcdf0b1fe8505028cc1f7419d798a7',
  '0x24de6b77e8bc31c40aa452926daa6bbab7a71b0f',
  '0x54cd89623888e8010fdea1c62e86265a9c6da950',
]);

export function getInternalTransferRecentRecipients(
  updates: IUserNonFundingLedgerUpdate[],
  source: string,
  subAccounts: string[],
) {
  const excluded = new Set(subAccounts.map((address) => address.toLowerCase()));
  const seen = new Set<string>();
  const recipients: { address: string; amount: string; token: string }[] = [];
  for (const { delta } of updates.toSorted((a, b) => b.time - a.time)) {
    if (
      delta.type === 'send' &&
      delta.user.toLowerCase() === source.toLowerCase()
    ) {
      const address = delta.destination.toLowerCase();
      const amount = new BigNumber(delta.amount);
      if (
        !getInternalTransferAddressError(address, source) &&
        !address.startsWith('0x200000000000000000000000') &&
        !internalTransferBridgeAddresses.has(address) &&
        !excluded.has(address) &&
        !seen.has(address) &&
        amount.isFinite() &&
        amount.gt(0)
      ) {
        seen.add(address);
        recipients.push({ address, amount: delta.amount, token: delta.token });
        if (recipients.length === 5) break;
      }
    }
  }
  return recipients;
}

export function getInternalTransferAddressError(
  destination: string,
  source: string,
): string | undefined {
  if (!ethers.utils.isAddress(destination)) return 'Enter a valid HL address.';
  const address = destination.toLowerCase();
  if (address === source.toLowerCase()) return 'Enter a different HL address.';
  // HyperCore system destinations initiate withdrawals instead of user transfers.
  if (
    /^0x0{40}$/.test(address) ||
    address.startsWith('0x20000000000000000000000000000000') ||
    address === HYPERLIQUID_DEPOSIT_ADDRESS.toLowerCase()
  )
    return 'Bridge and system addresses cannot receive this transfer.';
  return undefined;
}

export function isInternalTransferAmountValid(
  amount: string,
  maxAmount: string,
  decimals: number,
) {
  const value = new BigNumber(amount);
  return (
    /^\d+(\.\d+)?$/.test(amount) &&
    Number.isSafeInteger(decimals) &&
    decimals >= 0 &&
    (value.decimalPlaces() ?? Infinity) <= decimals &&
    value.isFinite() &&
    value.gt(0) &&
    value.lte(maxAmount)
  );
}

export function buildInternalTransferTokens(
  [meta, contexts]: ISpotMetaAndAssetCtxsResponse,
  spot: ISpotClearinghouseStateResponse,
): IInternalTransferToken[] {
  const prices = new Map<number, BigNumber>([[0, new BigNumber(1)]]);
  const contextsByCoin = new Map(
    contexts.map((context) => [context.coin, context]),
  );
  // Resolve direct USDC pairs first, then pairs quoted in those assets, like the HL selector.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const market of meta.universe) {
      const [base, quote] = market.tokens;
      const price = new BigNumber(
        contextsByCoin.get(market.name)?.markPx ?? 0,
      ).times(prices.get(quote) ?? 0);
      if (!prices.has(base) && price.isFinite() && price.gt(0))
        prices.set(base, price);
    }
  }
  // shortcut: spotMeta tokens only; extend metadata when adding outcome-token transfers.
  const balances = new Map(
    spot.balances
      .filter((balance) => 'token' in balance)
      .map((balance) => [balance.token, balance]),
  );
  return meta.tokens.map((token) => {
    const balance = balances.get(token.index);
    const total = new BigNumber(balance?.total ?? 0);
    const available = total.minus(balance?.spotHold ?? balance?.hold ?? 0);
    const usdValue = total.times(prices.get(token.index) ?? 0);
    return {
      id: token.tokenId,
      index: token.index,
      symbol: token.name,
      token: `${token.name}:${token.tokenId}`,
      decimals: token.weiDecimals,
      balance: available.isFinite()
        ? BigNumber.maximum(0, available).toFixed()
        : 'NaN',
      usdValue: usdValue.isFinite() ? usdValue.toFixed() : '0',
    };
  });
}
