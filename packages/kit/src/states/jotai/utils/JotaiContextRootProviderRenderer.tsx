import { memo } from 'react';

import type { IJotaiContextStoreMapValue } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { AccountSelectorRootProvider } from '../../../components/AccountSelector/AccountSelectorRootProvider';
import { DiscoveryBrowserRootProvider } from '../../../views/Discovery/components/DiscoveryBrowserRootProvider';
import { EarnProvider } from '../../../views/Earn/EarnProvider';
import { HomeTokenListRootProvider } from '../../../views/Home/components/HomeTokenListProvider/HomeTokenListRootProvider';
import { UrlAccountHomeTokenListProvider } from '../../../views/Home/components/HomeTokenListProvider/UrlAccountHomeTokenListProvider';
import { MarketWatchListProvider } from '../../../views/Market/MarketWatchListProvider';
import { MarketWatchListProviderV2 } from '../../../views/Market/MarketWatchListProviderV2';
import { PerpsRootProvider } from '../../../views/Perp/PerpsProvider';
import { SendConfirmRootProvider } from '../../../views/Send/components/SendConfirmProvider/SendConfirmRootProvider';
import { SignatureConfirmRootProvider } from '../../../views/SignatureConfirm/components/SignatureConfirmProvider/SignatureConfirmRootProvider';
import {
  SwapModalRootProvider,
  SwapRootProvider,
} from '../../../views/Swap/pages/SwapRootProvider';
import { UniversalSearchProvider } from '../../../views/UniversalSearch/pages/UniversalSearchProvider';

export type IJotaiContextRootProviderRendererProps = {
  mapEntries: [string, IJotaiContextStoreMapValue][];
  shouldMountPerpsColdStartRootProvider: boolean;
  shouldMountSwapColdStartRootProvider: boolean;
};

function JotaiContextRootProviderRendererCmp({
  mapEntries,
  shouldMountPerpsColdStartRootProvider,
  shouldMountSwapColdStartRootProvider,
}: IJotaiContextRootProviderRendererProps) {
  return (
    <>
      {shouldMountSwapColdStartRootProvider ? <SwapRootProvider /> : null}
      {shouldMountPerpsColdStartRootProvider ? <PerpsRootProvider /> : null}
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
              <AccountSelectorRootProvider
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
            return <DiscoveryBrowserRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.universalSearch: {
            return <UniversalSearchProvider key={key} />;
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
            return <SwapRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.swapModal: {
            return <SwapModalRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.marketSwapReview: {
            return null;
          }
          case EJotaiContextStoreNames.earn: {
            return <EarnProvider key={key} />;
          }
          case EJotaiContextStoreNames.sendConfirm: {
            return <SendConfirmRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.signatureConfirm: {
            return <SignatureConfirmRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.perps: {
            if (shouldMountPerpsColdStartRootProvider) {
              return null;
            }
            return <PerpsRootProvider key={key} />;
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
