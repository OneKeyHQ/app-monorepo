import { useCallback } from 'react';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { EarnNavigation } from '../views/Earn/earnUtils';
import useParseQRCode from '../views/ScanQrCode/hooks/useParseQRCode';

import useAppNavigation from './useAppNavigation';

function useWalletBanner({
  account,
  network,
  wallet,
  indexedAccountId,
}: {
  account: INetworkAccount | undefined;
  network: IServerNetwork | undefined;
  wallet: IDBWallet | undefined;
  indexedAccountId: string | undefined;
}) {
  const navigation = useAppNavigation();
  const parseQRCode = useParseQRCode();

  const handleBannerOnPress = useCallback(
    async (item: IWalletBanner) => {
      defaultLogger.wallet.walletBanner.walletBannerClicked({
        bannerId: item.id,
        type: 'jump',
      });
      if (
        item.hrefType === 'internal' &&
        item.href &&
        item.href.includes('/defi/staking')
      ) {
        const [path, query] = item.href.split('?');
        const paths = path.split('/');
        const provider = paths.pop();
        const symbol = paths.pop();
        const params = new URLSearchParams(query);
        const networkId = params.get('networkId');
        const vault = params.get('vault');
        if (provider && symbol && networkId) {
          const earnAccount =
            await backgroundApiProxy.serviceStaking.getEarnAccount({
              indexedAccountId,
              accountId: account?.id ?? '',
              networkId,
            });
          const navigationParams: {
            accountId?: string;
            networkId: string;
            indexedAccountId?: string;
            symbol: string;
            provider: string;
            vault?: string;
          } = {
            accountId: earnAccount?.accountId || account?.id || '',
            indexedAccountId:
              earnAccount?.account.indexedAccountId || indexedAccountId,
            provider,
            symbol,
            networkId,
          };
          if (vault) {
            navigationParams.vault = vault;
          }
          void EarnNavigation.pushDetailPageFromDeeplink(
            navigation,
            navigationParams,
          );
        }
        return;
      }

      if (item.href) {
        await parseQRCode.parse(item.href, {
          handlers: [
            EQRCodeHandlerNames.marketDetail,
            EQRCodeHandlerNames.sendProtection,
            EQRCodeHandlerNames.rewardCenter,
          ],
          qrWalletScene: false,
          autoHandleResult: true,
          defaultHandler: openUrlExternal,
          account,
          network,
          wallet,
        });
      }
    },
    [account, indexedAccountId, network, wallet, parseQRCode, navigation],
  );

  return {
    handleBannerOnPress,
  };
}

export { useWalletBanner };
