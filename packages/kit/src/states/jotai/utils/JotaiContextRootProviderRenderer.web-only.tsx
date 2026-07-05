import { memo } from 'react';

import type { IJotaiContextStoreMapValue } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTokenListRootProvider } from '../../../views/Home/components/HomeTokenListProvider/HomeTokenListRootProvider';
import { UrlAccountHomeTokenListProvider } from '../../../views/Home/components/HomeTokenListProvider/UrlAccountHomeTokenListProvider';
import { MarketWatchListProvider } from '../../../views/Market/MarketWatchListProvider';
import { MarketWatchListProviderV2 } from '../../../views/Market/MarketWatchListProviderV2';

type IJotaiContextRootProviderRendererProps = {
  mapEntries: [string, IJotaiContextStoreMapValue][];
  shouldMountPerpsColdStartRootProvider: boolean;
  shouldMountSwapColdStartRootProvider: boolean;
};

type IProviderWithoutProps = Record<string, unknown>;

type IAccountSelectorRootProviderProps = {
  enabledNumStr: string;
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
};

const AccountSelectorRootProviderLazy =
  LazyLoad<IAccountSelectorRootProviderProps>(async () => {
    const { AccountSelectorRootProvider } =
      await import('../../../components/AccountSelector/AccountSelectorRootProvider');
    return {
      default: function AccountSelectorRootProviderLazyImpl(
        props: IAccountSelectorRootProviderProps,
      ) {
        return <AccountSelectorRootProvider {...props} />;
      },
    };
  });

const DiscoveryBrowserRootProviderLazy = LazyLoad<IProviderWithoutProps>(
  async () => {
    const { DiscoveryBrowserRootProvider } =
      await import('../../../views/Discovery/components/DiscoveryBrowserRootProvider');
    return {
      default: function DiscoveryBrowserRootProviderLazyImpl() {
        return <DiscoveryBrowserRootProvider />;
      },
    };
  },
);

const EarnProviderLazy = LazyLoad<IProviderWithoutProps>(async () => {
  const { EarnProvider } = await import('../../../views/Earn/EarnProvider');
  return {
    default: function EarnProviderLazyImpl() {
      return <EarnProvider />;
    },
  };
});

const PerpsRootProviderLazy = LazyLoad<IProviderWithoutProps>(async () => {
  const { PerpsRootProvider } =
    await import('../../../views/Perp/PerpsProvider');
  return {
    default: function PerpsRootProviderLazyImpl() {
      return <PerpsRootProvider />;
    },
  };
});

const SendConfirmRootProviderLazy = LazyLoad<IProviderWithoutProps>(
  async () => {
    const { SendConfirmRootProvider } =
      await import('../../../views/Send/components/SendConfirmProvider/SendConfirmRootProvider');
    return {
      default: function SendConfirmRootProviderLazyImpl() {
        return <SendConfirmRootProvider />;
      },
    };
  },
);

const SignatureConfirmRootProviderLazy = LazyLoad<IProviderWithoutProps>(
  async () => {
    const { SignatureConfirmRootProvider } =
      await import('../../../views/SignatureConfirm/components/SignatureConfirmProvider/SignatureConfirmRootProvider');
    return {
      default: function SignatureConfirmRootProviderLazyImpl() {
        return <SignatureConfirmRootProvider />;
      },
    };
  },
);

const SwapRootProviderLazy = LazyLoad<IProviderWithoutProps>(async () => {
  const { SwapRootProvider } =
    await import('../../../views/Swap/pages/SwapRootProvider');
  return {
    default: function SwapRootProviderLazyImpl() {
      return <SwapRootProvider />;
    },
  };
});

const SwapModalRootProviderLazy = LazyLoad<IProviderWithoutProps>(async () => {
  const { SwapModalRootProvider } =
    await import('../../../views/Swap/pages/SwapRootProvider');
  return {
    default: function SwapModalRootProviderLazyImpl() {
      return <SwapModalRootProvider />;
    },
  };
});

const UniversalSearchProviderLazy = LazyLoad<IProviderWithoutProps>(
  async () => {
    const { UniversalSearchProvider } =
      await import('../../../views/UniversalSearch/pages/UniversalSearchProvider');
    return {
      default: function UniversalSearchProviderLazyImpl() {
        return <UniversalSearchProvider />;
      },
    };
  },
);

function JotaiContextRootProviderRendererCmp({
  mapEntries,
  shouldMountPerpsColdStartRootProvider,
  shouldMountSwapColdStartRootProvider,
}: IJotaiContextRootProviderRendererProps) {
  return (
    <>
      {shouldMountSwapColdStartRootProvider ? <SwapRootProviderLazy /> : null}
      {shouldMountPerpsColdStartRootProvider ? <PerpsRootProviderLazy /> : null}
      {mapEntries.map(([key, value]) => {
        const { accountSelectorInfo, count, storeName } = value;
        if (count <= 0) {
          return null;
        }

        switch (storeName) {
          case EJotaiContextStoreNames.accountSelector: {
            if (!accountSelectorInfo) {
              throw new OneKeyLocalError(
                'JotaiContextRootProvidersAutoMount ERROR: accountSelectorInfo is required',
              );
            }
            const { sceneName, sceneUrl, enabledNum } = accountSelectorInfo;
            return (
              <AccountSelectorRootProviderLazy
                key={key}
                sceneName={sceneName}
                sceneUrl={sceneUrl}
                enabledNumStr={enabledNum.join(',')}
              />
            );
          }
          case EJotaiContextStoreNames.homeAccountOverview:
          case EJotaiContextStoreNames.urlAccountOverview: {
            return null;
          }
          case EJotaiContextStoreNames.homeTokenList: {
            return <HomeTokenListRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.urlAccountHomeTokenList: {
            return <UrlAccountHomeTokenListProvider key={key} />;
          }
          case EJotaiContextStoreNames.discoveryBrowser: {
            return <DiscoveryBrowserRootProviderLazy key={key} />;
          }
          case EJotaiContextStoreNames.universalSearch: {
            return <UniversalSearchProviderLazy key={key} />;
          }
          case EJotaiContextStoreNames.marketWatchList: {
            return <MarketWatchListProvider key={key} />;
          }
          case EJotaiContextStoreNames.marketWatchListV2: {
            return <MarketWatchListProviderV2 key={key} />;
          }
          case EJotaiContextStoreNames.swap: {
            if (shouldMountSwapColdStartRootProvider) {
              return null;
            }
            return <SwapRootProviderLazy key={key} />;
          }
          case EJotaiContextStoreNames.swapModal: {
            return <SwapModalRootProviderLazy key={key} />;
          }
          case EJotaiContextStoreNames.marketSwapReview: {
            return null;
          }
          case EJotaiContextStoreNames.earn: {
            return <EarnProviderLazy key={key} />;
          }
          case EJotaiContextStoreNames.sendConfirm: {
            return <SendConfirmRootProviderLazy key={key} />;
          }
          case EJotaiContextStoreNames.signatureConfirm: {
            return <SignatureConfirmRootProviderLazy key={key} />;
          }
          case EJotaiContextStoreNames.perps: {
            if (shouldMountPerpsColdStartRootProvider) {
              return null;
            }
            return <PerpsRootProviderLazy key={key} />;
          }
          default: {
            const exhaustiveCheck: never = storeName;
            throw new OneKeyLocalError(
              `Unhandled storeName case: ${exhaustiveCheck as string}`,
            );
          }
        }
      })}
    </>
  );
}

export const JotaiContextRootProviderRenderer = memo(
  JotaiContextRootProviderRendererCmp,
);
