import { useRoute } from '@react-navigation/core';

import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { IDappSourceInfo } from '../background/IBackgroundApi';

// TODO rename useDappQuery
function useDappParams() {
  const route = useRoute();
  const query = (route.params as { query: string })?.query;
  let queryInfo: {
    sourceInfo?: IDappSourceInfo;
    unsignedMessage?: IUnsignedMessageEvm;
  } = {};

  try {
    queryInfo = JSON.parse(query);
    debugLogger.sendTx('useDappParams:', queryInfo);
  } catch (error) {
    debugLogger.sendTx('useDappParams:', query);
    console.error(`parse dapp query error: ${query}`);
  }

  return queryInfo;
}

export default useDappParams;
