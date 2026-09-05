/* cspell:ignore Infini */
import * as Linking from 'expo-linking';
import { isString } from 'lodash';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';
import { perpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import type { IEOneKeyDeepLinkParams } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  EOneKeyDeepLinkPath,
  ONEKEY_APP_DEEP_LINK,
  ONEKEY_APP_DEEP_LINK_NAME,
  ONEKEY_PERPS_APP_LINK_HOST,
  ONEKEY_PERPS_TEST_APP_LINK_HOST,
  ONEKEY_STOCKS_APP_LINK_HOST,
  ONEKEY_STOCKS_TEST_APP_LINK_HOST,
  ONEKEY_SWAP_APP_LINK_HOST,
  ONEKEY_UNIVERSAL_LINK_HOST,
  ONEKEY_UNIVERSAL_TEST_LINK_HOST,
  WALLET_CONNECT_DEEP_LINK,
  WALLET_CONNECT_DEEP_LINK_NAME,
  WalletConnectUniversalLinkPath,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAppUpdateRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { dismissNativeInAppBrowser } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { whenAppUnlocked } from '../../../utils/passwordUtils';
import { EarnNavigation } from '../../../views/Earn/earnUtils';
import { urlAccountNavigation } from '../../../views/Home/pages/urlAccount/urlAccountUtils';
import { marketNavigation } from '../../../views/Market/marketUtils';
import { openWebView } from '../../../views/WebView/utils/webViewNavigation';
import { captureAndReportLoggerUtmParamsFromUrl } from '../loggerUtmParams';

import { registerHandler } from './handler';
import { parseWebViewDeepLink } from './parseWebViewDeepLink';
import {
  handleReferralLandingUrl,
  isValidReferralCode,
  navigateToReferralLanding,
} from './referralLandingLink';

type IDeepLinkUrlParsedResult = {
  type: 'walletConnect';
  url: string;
  urlExtracted: string;
};
type IProcessDeepLinkParams = {
  url: string;
  parsedUrl: Linking.ParsedURL;
};

function getStringQueryParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }
  return undefined;
}

let pendingRedeemBitcoinVoucherInitialCode: string | undefined;
let redeemBitcoinVoucherOpenTask: Promise<void> | undefined;

async function openRedeemBitcoinVoucherDialog(initialCode?: string) {
  pendingRedeemBitcoinVoucherInitialCode = initialCode;

  redeemBitcoinVoucherOpenTask ??= (async () => {
    try {
      await whenAppUnlocked();
      const { showRedemptionCenterDialog } =
        await import('../../../views/Redemption/components');
      showRedemptionCenterDialog({
        initialCode: pendingRedeemBitcoinVoucherInitialCode,
        source: 'deeplink',
      });
    } finally {
      pendingRedeemBitcoinVoucherInitialCode = undefined;
      redeemBitcoinVoucherOpenTask = undefined;
    }
  })();

  await redeemBitcoinVoucherOpenTask;
}

async function openPrimeInfiniSubscriptionFromDeepLink({
  navigation,
}: {
  navigation: NonNullable<typeof appGlobals.$rootAppNavigation>;
}) {
  await whenAppUnlocked();
  const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
  if (!isLoggedIn) {
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
      params: { fromDeepLink: true },
    });
    return;
  }
  navigation.pushModal(EModalRoutes.PrimeModal, {
    screen: EPrimePages.PrimeInfiniSubscription,
  });
}

function getOneKeyDeepLinkPath({ hostname, path, scheme }: Linking.ParsedURL) {
  if (scheme !== ONEKEY_APP_DEEP_LINK && scheme !== ONEKEY_APP_DEEP_LINK_NAME) {
    return undefined;
  }
  return hostname ?? path?.slice(1);
}

async function handleReferralLandingAppDeepLink({
  parsedUrl,
}: IProcessDeepLinkParams) {
  if (
    getOneKeyDeepLinkPath(parsedUrl) !== EOneKeyDeepLinkPath.invited_by_friend
  ) {
    return false;
  }

  const { queryParams } = parsedUrl;
  const { code, page } =
    queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.invited_by_friend];
  if (!isValidReferralCode(code)) {
    return true;
  }

  await navigateToReferralLanding({
    code,
    page: page ?? '',
    fromDeepLink: true,
  });
  return true;
}

type IOneKeyAppLinkTarget =
  | { type: 'stocks' }
  | { type: 'perps' }
  | { type: 'swapHome' }
  | { type: 'market' }
  | {
      // Earn protocol detail universal link, mirroring the web route
      // /earn/:network/:symbol/:provider?vault= (EarnProtocolDetailsShare)
      type: 'earnProtocolDetail';
      network: string;
      symbol: string;
      provider: string;
      vault?: string;
    };

const ONEKEY_WEB_APP_UNIVERSAL_LINK_HOSTS = new Set<string>([
  ONEKEY_UNIVERSAL_LINK_HOST,
  ONEKEY_UNIVERSAL_TEST_LINK_HOST,
]);
const ONEKEY_STOCKS_APP_LINK_HOSTS = new Set<string>([
  ONEKEY_STOCKS_APP_LINK_HOST,
  ONEKEY_STOCKS_TEST_APP_LINK_HOST,
]);
const ONEKEY_PERPS_APP_LINK_HOSTS = new Set<string>([
  ONEKEY_PERPS_APP_LINK_HOST,
  ONEKEY_PERPS_TEST_APP_LINK_HOST,
]);
const ONEKEY_SWAP_APP_LINK_HOSTS = new Set<string>([ONEKEY_SWAP_APP_LINK_HOST]);

// expo-linking returns "swap" while the jest URL polyfill returns "/swap".
function normalizeAppLinkPath(path?: string | null) {
  return path?.replace(/^\/+|\/+$/gu, '').toLowerCase() ?? '';
}

function parseOneKeyAppLinkTarget({
  hostname,
  path,
  queryParams,
  scheme,
}: Linking.ParsedURL): IOneKeyAppLinkTarget | undefined {
  if (scheme !== 'https' || !hostname) {
    return undefined;
  }
  const host = hostname.toLowerCase();
  if (ONEKEY_STOCKS_APP_LINK_HOSTS.has(host)) {
    return { type: 'stocks' };
  }
  if (ONEKEY_PERPS_APP_LINK_HOSTS.has(host)) {
    return { type: 'perps' };
  }
  if (ONEKEY_SWAP_APP_LINK_HOSTS.has(host)) {
    return { type: 'swapHome' };
  }
  if (!ONEKEY_WEB_APP_UNIVERSAL_LINK_HOSTS.has(host)) {
    return undefined;
  }
  const normalizedPath = normalizeAppLinkPath(path);
  if (
    normalizedPath === 'swap' &&
    getStringQueryParam(queryParams?.tab)?.toLowerCase() ===
      ESwapTabSwitchType.STOCK
  ) {
    return { type: 'stocks' };
  }
  if (normalizedPath === 'perps') {
    return { type: 'perps' };
  }
  if (normalizedPath === 'market') {
    return { type: 'market' };
  }
  // Earn detail page universal link: /earn/:network/:symbol/:provider?vault=.
  // Cannot use normalizeAppLinkPath (it lowercases): server-side matching of
  // symbol/provider/vault is case-sensitive, so preserve the original casing.
  const rawSegments = (path ?? '')
    .replace(/^\/+|\/+$/gu, '')
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  if (rawSegments.length === 4 && rawSegments[0].toLowerCase() === 'earn') {
    const [, network, symbol, provider] = rawSegments;
    if (network && symbol && provider) {
      return {
        type: 'earnProtocolDetail',
        network,
        symbol,
        provider,
        vault: getStringQueryParam(queryParams?.vault),
      };
    }
  }
  return undefined;
}

async function getPerpsAppLinkTabRoute() {
  const { perpConfigCommon, perpConfigLoaded } =
    await perpsCommonConfigPersistAtom.get();
  // Mirrors usePerpTabConfig: the persisted disablePerp default only takes
  // effect after the remote config has actually loaded.
  if ((perpConfigLoaded ?? false) && perpConfigCommon?.disablePerp) {
    return undefined;
  }
  return perpConfigCommon?.usePerpWeb
    ? ETabRoutes.WebviewPerpTrade
    : ETabRoutes.Perp;
}

async function processOneKeyAppUniversalLink(
  params: IProcessDeepLinkParams,
  times = 0,
): Promise<boolean> {
  const target = parseOneKeyAppLinkTarget(params.parsedUrl);
  if (!target) {
    return false;
  }
  if (times > 10) {
    return true;
  }
  const navigation = appGlobals.$rootAppNavigation;
  if (!navigation) {
    setTimeout(() => {
      void processOneKeyAppUniversalLink(params, times + 1);
    }, 1500);
    return true;
  }
  if (target.type === 'stocks') {
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Swap,
      params: {
        screen: ETabSwapRoutes.TabSwap,
        params: {
          tab: ESwapTabSwitchType.STOCK,
        },
      },
    });
    return true;
  }
  if (target.type === 'swapHome') {
    // Explicit tab param resets any live Stock/Limit sub tab so the link
    // always lands on the plain Swap home, cold or warm.
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Swap,
      params: {
        screen: ETabSwapRoutes.TabSwap,
        params: {
          tab: ESwapTabSwitchType.SWAP,
        },
      },
    });
    return true;
  }
  if (target.type === 'market') {
    // Mirrors useNavigateToMarketTab: on native the Market tab is hidden and
    // merged into Discovery, so land on Discovery's market sub tab there;
    // elsewhere reset the Market tab stack back to TabMarket.
    if (platformEnv.isNative) {
      navigation.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Discovery,
        params: {
          screen: ETabDiscoveryRoutes.TabDiscovery,
          params: {
            defaultTab: ETranslations.global_market,
          },
        },
      });
      setTimeout(() => {
        appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
          tab: ETranslations.global_market,
        });
      }, 150);
    } else {
      navigation.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.TabMarket,
        },
      });
    }
    return true;
  }
  if (target.type === 'earnProtocolDetail') {
    // Reuse the safe Earn navigation: it handles the native Discovery
    // sub-tab switch, earn-mode switch, and stack push; if the protocol does
    // not exist, the detail page has its own error-state fallback
    EarnNavigation.pushToEarnProtocolDetailsShare(navigation, {
      network: target.network,
      symbol: target.symbol,
      provider: target.provider,
      vault: target.vault,
    });
    return true;
  }
  const perpsTabRoute = await getPerpsAppLinkTabRoute();
  if (perpsTabRoute) {
    // switchTabAsync serializes overlay dismiss and tab switch; the sync
    // switchTab is deprecated for the iOS RNSScreenStack orphan freeze.
    await navigation.switchTabAsync(perpsTabRoute);
  }
  return true;
}

async function processDeepLinkUrlAccount(
  params: IProcessDeepLinkParams,
  times = 0,
) {
  if (times > 10) {
    return;
  }
  try {
    const { parsedUrl } = params;
    const { queryParams, scheme } = parsedUrl;
    if (
      scheme === ONEKEY_APP_DEEP_LINK ||
      scheme === ONEKEY_APP_DEEP_LINK_NAME
    ) {
      console.log('processDeepLinkUrlAccount: >>>>> ', parsedUrl);
      const navigation = appGlobals.$rootAppNavigation;
      if (!navigation) {
        setTimeout(() => {
          void processDeepLinkUrlAccount(params, times + 1);
        }, 1500);
        return;
      }
      switch (getOneKeyDeepLinkPath(parsedUrl)) {
        case EOneKeyDeepLinkPath.url_account: {
          const query =
            queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.url_account];
          if (navigation) {
            await urlAccountNavigation.pushUrlAccountPageFromDeeplink(
              navigation,
              {
                networkId: query.networkCode,
                address: query.address,
              },
            );
          }
          break;
        }
        case EOneKeyDeepLinkPath.market_detail:
          {
            const { coinGeckoId } =
              queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.market_detail];
            if (navigation) {
              await marketNavigation.pushDetailPageFromDeeplink(navigation, {
                coinGeckoId,
              });
            }
          }
          break;
        case EOneKeyDeepLinkPath.invite_share:
          {
            const { utm_source: utmSource, code } =
              queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.invite_share];
            if (navigation) {
              // Navigate to Tab page instead of modal
              navigation.switchTab(ETabRoutes.ReferFriends);
              await timerUtils.wait(50);
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: ETabReferFriendsRoutes.TabReferAFriend,
                    params: {
                      utmSource,
                      code,
                    },
                  },
                ],
              });
            }
            defaultLogger.referral.page.enterReferralGuideFromDeepLink(
              code,
              utmSource,
            );
          }
          break;
        case EOneKeyDeepLinkPath.redeem_bitcoin_voucher:
          {
            const query =
              queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.redeem_bitcoin_voucher];
            const initialCode =
              getStringQueryParam(query?.code)?.trim() || undefined;
            await openRedeemBitcoinVoucherDialog(initialCode);
          }
          break;
        case EOneKeyDeepLinkPath.prime_subscription:
          await openPrimeInfiniSubscriptionFromDeepLink({ navigation });
          break;
        case EOneKeyDeepLinkPath.cross_device_transfer:
          console.log('TODO implement cross_device_transfer deeplink');
          break;
        case EOneKeyDeepLinkPath.webview: {
          const query =
            queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.webview];
          const webViewParams = parseWebViewDeepLink(query);
          if (webViewParams) {
            openWebView(webViewParams);
          }
          break;
        }
        case EOneKeyDeepLinkPath.preview_featured_changelog: {
          // Ops-only entry: opens the Featured Changelog preview page so
          // dashboard-configured changelog content can be verified in a
          // production build. Access is gated by the obscurity of this
          // deeplink — the page has no in-app navigation entry point.
          const query =
            queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.preview_featured_changelog];
          const version =
            getStringQueryParam(query?.version)?.trim() || undefined;
          navigation.pushModal(EModalRoutes.AppUpdateModal, {
            screen: EAppUpdateRoutes.FeaturedChangelogPreview,
            params: { version },
          });
          break;
        }
        default:
          break;
      }
    }
  } catch (_error) {
    //
  }
}

const getUniversalLink = async () => {
  const settings = await backgroundApiProxy.serviceDevSetting.getDevSetting();
  return settings.settings?.enableTestEndpoint
    ? ONEKEY_UNIVERSAL_TEST_LINK_HOST
    : ONEKEY_UNIVERSAL_LINK_HOST;
};

async function processDeepLinkWalletConnect({
  url,
  parsedUrl,
}: IProcessDeepLinkParams) {
  try {
    const { hostname, path, queryParams, scheme } = parsedUrl;

    let wcUri = '';
    // define deeplink schema at
    //  - packages/web/validation/deeplink.ios.json
    //  - packages/app/app.json

    const universalLinkHost = await getUniversalLink();
    // ** ios UniversalLink
    //        https://app.onekey.so/wc/connect/wc?uri=wc%3Aeb16df1f-1d3b-4018-9d18-28ef610cc1a4%401%3Fbridge%3Dhttps%253A%252F%252Fj.bridge.walletconnect.org%26key%3D0037246aefb211f98a8386d4bf7fd2a5344960bf98cb39c57fb312a098f2eb77
    // check UniversalLink allowed path here:
    //    https://app.onekey.so/.well-known/apple-app-site-association
    if (
      hostname === universalLinkHost &&
      path === WalletConnectUniversalLinkPath
    ) {
      if (queryParams?.uri) {
        wcUri = `${queryParams.uri as string}${
          queryParams?.symKey ? `&symKey=${queryParams?.symKey as string}` : ''
        }`;
      }
    }

    // ** ios/android/desktop DeepLink
    //        onekey-wallet://wc

    // oxlint-disable-next-line @cspell/spellchecker
    // onekey-wallet://wc?uri=wc%3Afa75a793-a3fb-48e4-8629-8f1f034ec6eb%401%3Fbridge%3Dhttps%253A%252F%252Fy.bridge.walletconnect.org%26key%3D9e97f71a32b4e629cb60106295dca54d733d124da480b4031d0d848b678fd610/
    if (
      scheme === ONEKEY_APP_DEEP_LINK ||
      scheme === ONEKEY_APP_DEEP_LINK_NAME
    ) {
      if (
        (path === WALLET_CONNECT_DEEP_LINK_NAME && !hostname) ||
        (path === `/${WALLET_CONNECT_DEEP_LINK_NAME}` && !hostname) ||
        (hostname === WALLET_CONNECT_DEEP_LINK_NAME && !path)
      ) {
        if (queryParams?.uri) {
          wcUri = `${queryParams.uri as string}${
            queryParams?.symKey
              ? `&symKey=${queryParams?.symKey as string}`
              : ''
          }`;
        }
      }
    }

    // ** WalletConnect uri DeepLink
    //        wc:

    // oxlint-disable-next-line @cspell/spellchecker
    // wc:c157eb01-8262-40e4-963e-7ebee47d0eac@1?bridge=https%3A%2F%2F7.bridge.walletconnect.org&key=881d859aa3ae028e284dd03e3be1d09c486329a400509a39c85246813808956b
    if (
      scheme === WALLET_CONNECT_DEEP_LINK ||
      scheme === WALLET_CONNECT_DEEP_LINK_NAME
    ) {
      // V1
      if (queryParams?.bridge && queryParams?.key) {
        // wcUri = url;
        throw new OneKeyLocalError('WalletConnect V1 is not supported');
      }
      // V2

      // oxlint-disable-next-line @cspell/spellchecker
      if (queryParams?.['relay-protocol'] && queryParams?.symKey) {
        wcUri = url;
      }
    }

    if (wcUri) {
      console.log('Create walletConnect connection by DeepLink: ', wcUri);

      await backgroundApiProxy.walletConnect.connectToDapp(wcUri);
      return {
        type: 'walletConnect',
        url,
        urlExtracted: wcUri,
      };
    }
  } catch (error) {
    console.error('connectToWalletConnectByDeepLink ERROR: ', error);
  }
}

const processDeepLinkUrl = memoizee(
  // parameter should be flatten, as memoizee primitive=true
  async (
    url: string | undefined,
  ): Promise<IDeepLinkUrlParsedResult | undefined> => {
    // handle deepLink URL
    if (!url) return;

    try {
      // An open SFSafariViewController would cover any navigation this deep
      // link triggers; close it first (iOS-only, no-op elsewhere).
      dismissNativeInAppBrowser();
      console.log('processDeepLinkUrl: >>>>> ', url);
      captureAndReportLoggerUtmParamsFromUrl(url);
      if (await handleReferralLandingUrl({ url })) {
        return;
      }

      const parsedUrl = Linking.parse(url);
      const { hostname, path, queryParams, scheme } = parsedUrl;
      if (process.env.NODE_ENV !== 'production') {
        console.log('processDeepLinkUrl details >>>> ', {
          url,
          hostname,
          path,
          queryParams,
          scheme,
        });
      }
      if (await handleReferralLandingAppDeepLink({ url, parsedUrl })) {
        return;
      }
      if (await processOneKeyAppUniversalLink({ url, parsedUrl })) {
        return;
      }
      await processDeepLinkUrlAccount({ url, parsedUrl });
      await processDeepLinkWalletConnect({ url, parsedUrl });
    } catch (e) {
      console.error('processDeepLinkUrl ERROR: ', e);
    }
  },
  {
    primitive: true,
    max: 20,
    maxAge: 600,
  },
);

// For feature code (e.g. the banner) to try before opening a webpage: if the
// URL is an official universal link (earn detail / market / perps, etc.),
// navigate natively and return true; otherwise return false and the caller
// opens the webpage as before.
export const tryHandleOneKeyUniversalLink = async (
  url: string,
): Promise<boolean> => {
  try {
    const parsedUrl = Linking.parse(url);
    return await processOneKeyAppUniversalLink({ url, parsedUrl });
  } catch {
    return false;
  }
};

export const handleDeepLinkUrl = (data: IDesktopOpenUrlEventData) => {
  const urls = [data.url, ...(data.argv ?? [])].filter(
    (item) => !!item && isString(item),
  );
  urls.forEach((url) => {
    console.log('processDeepLinkUrl >>>>>> ', url);
    void processDeepLinkUrl(url);
  });
};

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  globalThis.$$handleDeepLinkUrl = handleDeepLinkUrl;
}

export const registerDeepLinking = () => registerHandler(handleDeepLinkUrl);
