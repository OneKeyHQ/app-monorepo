import { useBuyToken } from '@onekeyhq/kit/src/hooks/useBuyToken';

import { RawActions } from './RawActions';

type IProps = {
  networkId: string | undefined;
  accountId: string | undefined;
};

export function WalletActionBuy(props: IProps) {
  const { networkId, accountId } = props;
  const { isSupported, handleOnBuy } = useBuyToken({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });

  return <RawActions.Buy onPress={handleOnBuy} disabled={!isSupported} />;
}
