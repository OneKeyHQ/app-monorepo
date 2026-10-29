import type { IEncodedTxZcash } from '@onekeyhq/kit-bg/src/vaults/impls/zcash/types';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';

export function getZcashEncodedTx(
  encodedTx: unknown,
): IEncodedTxZcash | undefined {
  if (encodedTx && typeof encodedTx === 'object' && 'zcashMode' in encodedTx) {
    return encodedTx as IEncodedTxZcash;
  }
  return undefined;
}

export function isZcashShieldedSpend(encodedTx: unknown): boolean {
  return getZcashEncodedTx(encodedTx)?.zcashMode === 'privacy';
}

export function replaceAccountAddressComponent({
  components,
  signer,
  address,
}: {
  components: IDisplayComponent[];
  signer: string;
  address: string | undefined;
}): IDisplayComponent[] {
  if (!address) return components;
  const index = components.findIndex(
    (component) => component.type === EParseTxComponentType.Address,
  );
  const target = components[index];
  if (
    !target ||
    target.type !== EParseTxComponentType.Address ||
    target.address !== signer ||
    target.address === address
  ) {
    return components;
  }
  const next = [...components];
  next[index] = { ...target, address };
  return next;
}
