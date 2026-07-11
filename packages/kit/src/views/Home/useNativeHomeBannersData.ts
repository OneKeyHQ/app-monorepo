import { useCallback, useEffect, useRef, useState } from 'react';

import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

export function useNativeHomeBannersData() {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [banners, setBanners] = useState<IWalletBanner[]>([]);
  const requestIdRef = useRef(0);
  const { handleBannerOnPress } = useWalletBanner({ account, network, wallet });

  const filterBanners = useCallback(
    (values: IWalletBanner[], closedForever: Record<string, boolean> = {}) =>
      values.filter((banner) => {
        if (closedForever[banner.id]) return false;
        if (banner.position && banner.position !== 'home') return false;
        if (
          banner.networkIds?.length &&
          (!network?.id || !banner.networkIds.includes(network.id))
        ) {
          return false;
        }
        return true;
      }),
    [network?.id],
  );

  const refresh = useCallback(async () => {
    if (!account?.id) {
      setBanners([]);
      return;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const local = await backgroundApiProxy.simpleDb.walletBanner.getRawData();
    const localBanners = filterBanners(
      local?.topBanners ?? [],
      local?.closedForever,
    );
    if (requestIdRef.current === requestId) {
      setBanners(localBanners);
    }
    try {
      const remote =
        await backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
          accountId: account.id,
        });
      const next = filterBanners(remote, local?.closedForever);
      if (requestIdRef.current === requestId) {
        setBanners(next);
      }
      await backgroundApiProxy.serviceWalletBanner.updateLocalTopBanners({
        topBanners: next,
      });
    } catch {
      // The local banner cache remains visible when the network request fails.
    }
  }, [account?.id, filterBanners]);

  useEffect(() => {
    void refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  const dismiss = useCallback(async (banner: IWalletBanner) => {
    if (!banner.closeable) return;
    setBanners((previous) => previous.filter((item) => item.id !== banner.id));
    if (banner.closeForever) {
      await backgroundApiProxy.serviceWalletBanner.updateClosedForeverBanners({
        bannerId: banner.id,
        closedForever: true,
      });
    }
  }, []);

  return {
    banners,
    dismiss,
    handleBannerOnPress,
    refresh,
  };
}
