import { TransferReceiverAdapter } from '../prime-transfer/transfer-receiver-adapter';

import type {
  ICreateTransferPairingSessionParams,
  ITransferPairingSession,
  TransferPayloadHandler,
} from '../prime-transfer/transfer-types';

interface IAppTransferLoginDependencies {
  receiverAdapter?: Pick<TransferReceiverAdapter, 'createPairingSession'>;
  onTransferData?: TransferPayloadHandler;
}

export async function startAppTransferLogin(
  params: ICreateTransferPairingSessionParams = {},
  {
    receiverAdapter = new TransferReceiverAdapter(),
    onTransferData,
  }: IAppTransferLoginDependencies = {},
): Promise<ITransferPairingSession> {
  return receiverAdapter.createPairingSession(params, {
    onTransferData,
  });
}
