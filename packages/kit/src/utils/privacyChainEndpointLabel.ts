import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getPrivacyChainDisplayPools,
  getPrivacyChainTargetItem,
  isLocalWalletDisplayedAddress,
} from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import type {
  IPrivacyChainAccountAddresses,
  IPrivacyChainDisplayPool,
  IPrivacyChainEndpointItem,
  IPrivacyChainShieldedEndpointLabel,
} from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import type { IDecodedTxShieldedEndpoint } from '@onekeyhq/shared/types/tx';

import type { IntlShape } from 'react-intl';

// The parts of settings.localWallet history display reads.
export type IPrivacyChainLocalWalletSettings = {
  pools?: IPrivacyChainDisplayPool[];
  historyOnlyPools?: { id: number; label: string }[];
  hiddenEndpointLabelId?: ETranslations | ETranslationsMock;
  publicAddressPattern?: string;
  privateAddressPattern?: string;
};

export type IPrivacyChainLocalWalletDisplay = Omit<
  IPrivacyChainLocalWalletSettings,
  'historyOnlyPools'
> & {
  // A chain with a single pool has no pool to name.
  isSinglePool: boolean;
};

export function toPrivacyChainLocalWalletDisplay(
  localWallet: IPrivacyChainLocalWalletSettings,
): IPrivacyChainLocalWalletDisplay {
  return {
    ...localWallet,
    pools: getPrivacyChainDisplayPools(localWallet),
    isSinglePool: (localWallet.pools?.length ?? 0) <= 1,
  };
}

// Display text for a shielded endpoint: its pool, else the chain's name for
// an endpoint it keeps private.
export function formatPrivacyChainEndpointLabel({
  intl,
  localWallet,
  endpoint,
}: {
  intl: IntlShape;
  localWallet?: IPrivacyChainLocalWalletDisplay;
  endpoint: IPrivacyChainShieldedEndpointLabel;
}): string {
  const pool =
    endpoint.poolId === undefined || localWallet?.isSinglePool
      ? undefined
      : localWallet?.pools?.find((item) => item.id === endpoint.poolId);
  if (pool) {
    return intl.formatMessage(
      {
        id: ETranslationsMock.privacy_history_pool__label,
        defaultMessage: ETranslationsMock.privacy_history_pool__label,
      },
      { pool: pool.label },
    );
  }
  const id =
    localWallet?.hiddenEndpointLabelId ??
    ETranslationsMock.privacy_history_shielded__label;
  // Mock ids are their own English text until translated.
  return intl.formatMessage({ id, defaultMessage: id });
}

// How one history endpoint renders: a copyable address, or a pool name that
// is never offered as an address.
export type IPrivacyChainEndpointDisplay =
  | { address: string; poolLabel?: string; isOwn?: boolean }
  | { address?: undefined; poolLabel: string; isOwn?: boolean };

export function resolvePrivacyChainEndpointDisplay({
  intl,
  localWallet,
  addresses,
  item,
}: {
  intl: IntlShape;
  localWallet?: IPrivacyChainLocalWalletDisplay;
  addresses?: IPrivacyChainAccountAddresses | null;
  item: IPrivacyChainEndpointItem;
}): IPrivacyChainEndpointDisplay {
  if (item.kind === 'address') return { address: item.address };
  const poolLabel = formatPrivacyChainEndpointLabel({
    intl,
    localWallet,
    endpoint: { poolId: item.poolId },
  });
  if (item.kind !== 'own') return { poolLabel };
  if (item.address) {
    // An own address the data names is shown only when it is exactly one the
    // Receive / token details pages display.
    return isLocalWalletDisplayedAddress({ addresses, address: item.address })
      ? { address: item.address, poolLabel, isOwn: true }
      : { poolLabel, isOwn: true };
  }
  // No address in the data (e.g. a shielded spend): never fill one in.
  return { poolLabel, isOwn: true };
}

// The single counterparty a history list row names.
export function resolvePrivacyChainTargetDisplay({
  intl,
  localWallet,
  addresses,
  address,
  shielded,
  side,
  ownAddresses,
}: {
  intl: IntlShape;
  localWallet: IPrivacyChainLocalWalletDisplay;
  addresses?: IPrivacyChainAccountAddresses | null;
  address: string;
  shielded?: IDecodedTxShieldedEndpoint;
  side: 'from' | 'to';
  // Addresses the row says are ours (collectPrivacyChainOwnAddresses); they
  // must pass the displayed-address check too.
  ownAddresses: Set<string>;
}): IPrivacyChainEndpointDisplay | undefined {
  const item = getPrivacyChainTargetItem({
    pools: localWallet.pools,
    publicAddressPattern: localWallet.publicAddressPattern,
    privateAddressPattern: localWallet.privateAddressPattern,
    address,
    shielded,
    side,
    ownAddresses,
  });
  return item
    ? resolvePrivacyChainEndpointDisplay({ intl, localWallet, addresses, item })
    : undefined;
}

// Whether a list row's target is this account's, so it needs the account's
// displayed addresses to be checked against.
export function isPrivacyChainOwnTarget({
  address,
  shielded,
  ownAddresses,
}: {
  address: string;
  shielded?: IDecodedTxShieldedEndpoint;
  ownAddresses: Set<string>;
}): boolean {
  return !!shielded?.isOwn || (!!address && ownAddresses.has(address));
}
