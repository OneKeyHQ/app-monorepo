import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { localWalletText } from './messages';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// An enabled custom node wins; otherwise the default one, so turning a custom node off never stops sync.
export async function resolveLocalWalletNodeUrl({
  backgroundApi,
  networkId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
}): Promise<string> {
  const url = await backgroundApi.serviceCustomRpc.resolveRpcUrlWithBuiltIn({
    networkId,
  });
  if (!url) {
    throw new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_no_node__msg),
    );
  }
  return url;
}
