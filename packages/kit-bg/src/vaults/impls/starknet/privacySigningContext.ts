import type CoreChainSoftware from '@onekeyhq/core/src/chains/starknet/CoreChainSoftware';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IDeriveStrk20ViewingKeyParams,
  ISignStrk20ProofInvocationParams,
} from './privacyKeyringTypes';
import type { KeyringSoftwareBase } from '../../base/KeyringSoftwareBase';

type IStarknetSoftwareKeyring = KeyringSoftwareBase & {
  coreApi: CoreChainSoftware;
};

async function getPrivacySigningContext(
  keyring: KeyringSoftwareBase,
  password: string,
) {
  if (!keyring.coreApi) throw new OneKeyLocalError('coreApi is not defined');
  const account = await keyring.vault.getAccount();
  const credentials = await keyring.baseGetCredentialsInfo({ password });
  const networkInfo = await keyring.getCoreApiNetworkInfo();
  const addressEncoding = await keyring.vault.getAddressEncoding();
  return { account, credentials, networkInfo, addressEncoding, password };
}

export async function deriveSoftwareViewingKey(
  keyring: IStarknetSoftwareKeyring,
  params: IDeriveStrk20ViewingKeyParams,
) {
  const { password, chainId, accountAddress, poolAddress, keyIndex } = params;
  const context = await getPrivacySigningContext(keyring, password);
  return keyring.coreApi.deriveStrk20ViewingKey({
    ...context,
    chainId,
    accountAddress,
    poolAddress,
    keyIndex,
  });
}

export async function signSoftwareProofInvocation(
  keyring: IStarknetSoftwareKeyring,
  params: ISignStrk20ProofInvocationParams,
) {
  const context = await getPrivacySigningContext(keyring, params.password);
  return keyring.coreApi.signStrk20ProofInvocation({
    ...context,
    invocation: params.invocation,
  });
}
