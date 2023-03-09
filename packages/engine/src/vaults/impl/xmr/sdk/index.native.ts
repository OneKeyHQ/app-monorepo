/* eslint-disable @typescript-eslint/no-unsafe-return */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { pubKeysToAddress } from './moneroAddress';
import { privateSpendKeyToWords } from './moneroWords';

const ProvideMethod = 'callMoneroWebEmbedMethod';
enum MoneroEvent {
  getKeyPairFromRawPrivatekey = 'Monero_getKeyPairFromRawPrivatekey',
}

type IResult = { error: any; result: any };
/**
 * ensure web-embed is created successfully
 */
const ensureSDKReady = async () =>
  new Promise((resolve) => {
    appUIEventBus.emit(
      AppUIEventBusNames.EnsureChainWebEmbed,
      () => {
        debugLogger.common.debug('ensure web embed exist resolve callback');
        resolve(true);
      },
      OnekeyNetwork.xmr,
    );
  });

const getKeyPairFromRawPrivatekey = async (params: {
  rawPrivateKey: Buffer;
  index?: number;
}) => {
  await ensureSDKReady();
  debugLogger.common.debug('ensure web embed exist');
  const result = (await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
    method: ProvideMethod,
    event: MoneroEvent.getKeyPairFromRawPrivatekey,
    params,
  })) as IResult;

  if (result.error) {
    debugLogger.providerApi.error(
      'moenro web-embed getKeyPairFromRawPrivatekey error: ',
      result.error,
    );
    throw new Error(result.error);
  }
  debugLogger.providerApi.info(
    'monero web-embed getKeyPairFromRawPrivatekey success: ',
    result.result,
  );
  return result.result;
};

const getMoneroApi = async () =>
  Promise.resolve({
    getKeyPairFromRawPrivatekey,
    privateSpendKeyToWords,
    pubKeysToAddress,
  });

export { getMoneroApi, ensureSDKReady };
