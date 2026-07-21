import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_QR,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';
import type { IHomeRuntimeOwnerScope } from '@onekeyhq/shared/src/types/homeRuntime';

import { buildHomeOwnerScopeKey } from '../core/homeIdentity';

import { createIdleHomeSourceFacts } from './homeFacts';

import type {
  IHomeAccountType,
  IHomeBackupStatus,
  IHomeFacts,
  IHomeNetworkFamily,
} from './homeFacts';
import type { IHomeSessionSnapshot } from '../lifecycle/homeSessionCoordinator';

export type ICurrentHomeFactsAdapterInput = {
  owner: IHomeRuntimeOwnerScope;
  authority: IHomeSessionSnapshot;
  wallet: {
    ready: boolean;
    backuped?: boolean;
    type?: string;
  };
  network: {
    hasAccount: boolean;
    family?: string;
  };
};

function normalizeAccountType(type: string | undefined): IHomeAccountType {
  if (type === WALLET_TYPE_HW) {
    return 'hardware';
  }
  switch (type) {
    case WALLET_TYPE_HD:
      return 'hd';
    case WALLET_TYPE_IMPORTED:
      return 'imported';
    case WALLET_TYPE_WATCHING:
      return 'watching';
    case WALLET_TYPE_EXTERNAL:
      return 'external';
    case WALLET_TYPE_QR:
      return 'qr';
    default:
      return 'unknown';
  }
}

function normalizeNetworkFamily({
  allNetworks,
  family,
}: {
  allNetworks: boolean;
  family?: string;
}): IHomeNetworkFamily {
  if (allNetworks) {
    return 'allNetworks';
  }
  if (
    family === 'btc' ||
    family === 'evm' ||
    family === 'sol' ||
    family === 'ton' ||
    family === 'tron'
  ) {
    return family;
  }
  return 'unknown';
}

function resolveRuntimeConnection(
  status: IHomeSessionSnapshot['status'],
): IHomeFacts['runtime']['connection'] {
  if (status === 'active') {
    return 'ready';
  }
  if (status === 'degraded') {
    return 'degraded';
  }
  return 'waiting';
}

function resolveBackupStatus({
  accountType,
  backuped,
}: {
  accountType: IHomeAccountType;
  backuped?: boolean;
}): IHomeBackupStatus {
  if (backuped === true) {
    return 'complete';
  }
  if (accountType === 'unknown') {
    return 'unknown';
  }
  if (accountType !== 'hd') {
    return 'notApplicable';
  }
  return backuped === false ? 'required' : 'unknown';
}

export function adaptCurrentHomeFacts(
  input: ICurrentHomeFactsAdapterInput,
): IHomeFacts | undefined {
  const ownerToken = input.authority.ownerToken;
  if (
    !ownerToken ||
    ownerToken.scopeKey !== buildHomeOwnerScopeKey(input.owner)
  ) {
    return undefined;
  }
  const accountType = normalizeAccountType(input.wallet.type);
  const runtimeConnection = resolveRuntimeConnection(input.authority.status);
  const allNetworks = input.owner.network.kind === 'allNetworks';
  return {
    owner: input.owner,
    ownerToken,
    wallet: {
      ready: input.wallet.ready,
      hasNetworkAccount: input.network.hasAccount,
      backupStatus: resolveBackupStatus({
        accountType,
        backuped: input.wallet.backuped,
      }),
      accountType,
    },
    environment: { theme: 'unknown' },
    runtime: {
      topology: input.authority.topology,
      connection: runtimeConnection,
      producerInstanceId: input.authority.producerInstanceId,
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
    },
    capabilityInputs: {
      ready: false,
      networkFamily: normalizeNetworkFamily({
        allNetworks,
        family: input.network.family,
      }),
      accountType,
      allNetworks,
      serverConfig: {
        perps: false,
        defi: false,
        nft: false,
        history: false,
        market: false,
      },
      productAvailability: {
        perps: false,
        defi: false,
        nft: false,
        history: false,
        market: false,
      },
    },
    sources: createIdleHomeSourceFacts(),
    confirmed: {},
  };
}
