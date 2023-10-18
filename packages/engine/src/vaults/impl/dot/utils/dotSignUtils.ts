import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { stripHexPrefix } from '@onekeyhq/shared/src/utils/hexUtils';

import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { ISignCredentialOptions, IUnsignedTxPro } from '../../../types';
import type { IEncodedTxDot } from '../types';
import type Vault from '../Vault';

export async function signTransactionDot({
  keyring,
  unsignedTx,
  options,
}: {
  keyring: KeyringSoftwareBase;
  unsignedTx: IUnsignedTxPro;
  options: ISignCredentialOptions;
}) {
  const vault = keyring.vault as Vault;

  // serialize to rawTx here but not in core api, as it requires network
  const { hash: message } = await vault.serializeUnsignedTransaction(
    unsignedTx.payload.encodedTx as IEncodedTxDot,
  );
  unsignedTx.rawTxUnsigned = bufferUtils.bytesToHex(message);

  const { txid, signature } = await keyring.baseSignTransaction(
    unsignedTx,
    options,
  );

  // should build rawTx here but not in core api, as it requires network
  const rawTx = await vault.serializeSignedTransaction(
    unsignedTx.payload.encodedTx as IEncodedTxDot,
    stripHexPrefix(checkIsDefined(signature)),
  );

  return {
    txid,
    rawTx,
    signature,
  };
}
