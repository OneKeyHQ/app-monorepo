import { useBuyToken } from '@onekeyhq/kit/src/hooks/useBuyToken';

import { RawActions } from './RawActions';

export function WalletActionBuy() {
  const { isSupported, handleOnBuy } = useBuyToken();

  return <RawActions.Buy onPress={handleOnBuy} disabled={!isSupported} />;
}
