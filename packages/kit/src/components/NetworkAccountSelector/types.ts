import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';

export type AccountGroup = { title: Network; data: AccountEngineType[] };
