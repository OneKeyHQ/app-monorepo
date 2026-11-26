import type { IStrk20ViewingKeyResult } from '@onekeyhq/core/src/chains/starknet/sdkStarknet/viewingKey';
import type {
  IStarknetSignature,
  IStrk20ProofInvocationPayload,
} from '@onekeyhq/core/src/chains/starknet/types';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

export type IDeriveStrk20ViewingKeyParams = {
  password: string;
  deviceParams?: IDeviceSharedCallParams;
  chainId: string;
  accountAddress: string;
  poolAddress: string;
  keyIndex?: number;
};
export type IDeriveStrk20ViewingKeyResult = Pick<
  IStrk20ViewingKeyResult,
  'viewingKey' | 'publicKeyX'
> & { counter?: number };

export type ISignStrk20ProofInvocationParams = {
  password: string;
  deviceParams?: IDeviceSharedCallParams;
  invocation: IStrk20ProofInvocationPayload;
};

export type IKeyringStrk20ProofInvocationSigner = {
  signStrk20ProofInvocation: (
    params: ISignStrk20ProofInvocationParams,
  ) => Promise<IStarknetSignature>;
};

export type IKeyringStrk20ViewingKeyDeriver = {
  deriveStrk20ViewingKey: (
    params: IDeriveStrk20ViewingKeyParams,
  ) => Promise<IDeriveStrk20ViewingKeyResult>;
};
