import TonWeb from 'tonweb';

import type { IEncodedTxTon } from '../types';
import type { Cell } from 'tonweb/dist/types/boc/cell';

export function serializeSignedTx({
  fromAddress,
  signingMessage,
  signature,
  stateInit,
}: {
  fromAddress: string;
  signingMessage: Cell;
  signature: Uint8Array;
  stateInit?: Cell;
}) {
  const body = new TonWeb.boc.Cell();
  body.bits.writeBytes(signature);
  body.writeCell(signingMessage);
  const header = TonWeb.Contract.createExternalMessageHeader(fromAddress);
  const message = TonWeb.Contract.createCommonMsgInfo(header, stateInit, body);
  return message;
}

export function getStateInitFromEncodedTx(
  encodedTx: IEncodedTxTon,
): Cell | undefined {
  const msg = encodedTx.messages.find((message) => !!message.stateInit);
  if (!msg || !msg.stateInit) {
    return undefined;
  }
  return TonWeb.boc.Cell.oneFromBoc(msg.stateInit);
}
