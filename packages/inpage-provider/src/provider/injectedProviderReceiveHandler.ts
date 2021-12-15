import { IInpageProviderRequestData, IJsBridgeMessagePayload } from '../types';

function injectedProviderReceiveHandler(payload: IJsBridgeMessagePayload) {
  // ethereum, solana, conflux
  const providerHub = window.$onekey;

  console.log('ethereum onMessage', payload);
  const payloadData = payload.data as IInpageProviderRequestData;
  const { method } = payloadData;

  const { ethereum } = providerHub;
  if (!ethereum) {
    return;
  }
  // baseProvider
  //   -> this._jsonRpcConnection.events.on('notification'
  if (method === 'metamask_chainChanged') {
    ethereum._updateChainId(
      (payloadData.params as { chainId: string }).chainId,
    );
  }
  if (method === 'metamask_accountsChanged') {
    ethereum._updateAccounts(payloadData.params as Array<string>);
  }
}

export default injectedProviderReceiveHandler;
