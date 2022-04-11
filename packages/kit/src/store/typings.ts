import type { Network as EngineNetwork } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';

export type ValuedToken = Token & { balance?: string };
export type Network = EngineNetwork;
