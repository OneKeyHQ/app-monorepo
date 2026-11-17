import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { normalizeTaskAccountAddress } from './taskAddress';

import type { IDepositTaskIdentity } from './state';

export { normalizeTaskAccountAddress } from './taskAddress';

export async function getTaskAccountAddress({
  accountId,
  networkId,
}: Pick<IDepositTaskIdentity, 'accountId' | 'networkId'>) {
  const address =
    await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
      accountId,
      networkId,
    });
  if (!address.trim())
    throw new OneKeyLocalError('Missing task account address');
  return address;
}

export async function isTaskAccountCurrent(
  identity: Pick<
    IDepositTaskIdentity,
    'accountId' | 'accountAddress' | 'networkId'
  >,
) {
  const address = await getTaskAccountAddress(identity);
  return isTaskAccountAddress(identity, address);
}

export function isTaskAccountAddress(
  identity: Pick<IDepositTaskIdentity, 'accountAddress' | 'networkId'>,
  address: string,
) {
  return (
    normalizeTaskAccountAddress(identity.networkId, address) ===
    normalizeTaskAccountAddress(identity.networkId, identity.accountAddress)
  );
}

export function isTaskEncodedTxOwner(
  identity: Pick<IDepositTaskIdentity, 'accountAddress' | 'networkId'>,
  encodedTx: IEncodedTx,
) {
  if (!networkUtils.isEvmNetwork({ networkId: identity.networkId }))
    return true;
  return Boolean(
    typeof encodedTx === 'object' &&
    encodedTx !== null &&
    'from' in encodedTx &&
    typeof encodedTx.from === 'string' &&
    isTaskAccountAddress(identity, encodedTx.from),
  );
}
