import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAppUpdateRoutes,
  EGalleryRoutes,
  EModalReferFriendsRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
  ETabDeveloperRoutes,
  ETabMarketRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
  ETabSwapRoutes,
  ETestModalPages,
} from '@onekeyhq/shared/src/routes';

interface IAllowSettingItem {
  /** whether to show URL parameters, it is false in default. */
  showParams: boolean;
  showUrl?: boolean;
}

export type IScreenPathConfig = Record<
  string,
  {
    path: string;
    exact: boolean;
    screens?: IScreenPathConfig;
  }
>;

const removeExtraSlash = (path: string) => path.replace(/\/+/g, '');
const addPath = (prev: string, path: string) => {
  if (!path) {
    return prev;
  }

  if (!prev) {
    return path;
  }
  if (prev.endsWith('/')) {
    return `${prev}${path}`;
  }
  return `${prev}/${path}`;
};

const allowListMap = new Map<string, string>();

const buildAllowListMapKey = (screenNames: string[]) => screenNames.join(',');

export const getAllowPathFromScreenNames = (screenNames: string[]) =>
  allowListMap.get(buildAllowListMapKey(screenNames)) || '/';

export const buildAllowList = (
  screens: IScreenPathConfig,
  perpDisabled: boolean,
  perpTabShowWeb?: boolean,
) => {
  // if (platformEnv.isDev) {
  //   // Check for duplicate screen names in the screens configuration
  //   const screenNameMap = new Map<string, string[]>();
  //   const checkDuplicateScreenNames = (
  //     config: IScreenPathConfig,
  //     parentPath: string[] = [],
  //   ) => {
  //     Object.entries(config).forEach(([name, screen]) => {
  //       const path = [...parentPath, name];
  //       const pathStr = path.join(' > ');

  //       if (screenNameMap.has(name)) {
  //         const existingPaths = screenNameMap.get(name) || [];
  //         existingPaths.push(pathStr);
  //         screenNameMap.set(name, existingPaths);
  //         console.warn(
  //           `Duplicate screen name found: "${name}" at paths:`,
  //           existingPaths.join(', '),
  //         );
  //         throw new OneKeyLocalError(
  //           `Duplicate screen name "${name}" found at: ${existingPaths.join(
  //             ', ',
  //           )}`,
  //         );
  //       } else {
  //         screenNameMap.set(name, [pathStr]);
  //       }

  //       if (screen.screens) {
  //         checkDuplicateScreenNames(screen.screens, path);
  //       }
  //     });
  //   };

  //   checkDuplicateScreenNames(screens);
  // }
  function pagePath(_: TemplateStringsArray, ...screenNames: string[]): string {
    let screenConfig = screens;
    const path = screenNames.reduce((prev, screenName) => {
      const screen = screenConfig[screenName];
      if (platformEnv.isDev) {
        if (!screen) {
          try {
            throw new OneKeyLocalError(`screen ${screenName} not found`);
          } catch (error) {
            console.error(error);
          }
        }
      }
      // keep the path random if the screen is not found
      if (!screen) {
        return Math.random().toString();
      }
      const nextScreenConfig = screen.screens;
      if (nextScreenConfig) {
        screenConfig = nextScreenConfig;
      }
      const paths = screen.path.split('/:');
      const rawPath = removeExtraSlash(paths[0]);
      const screenPath = paths.length > 1 ? `${rawPath}/.` : rawPath;
      // if the path is rewritten path, the full path will be rewritten.
      return screen.exact ? screenPath : addPath(prev, screenPath);
    }, '');
    const fullPath = `/${path}`;
    allowListMap.set(buildAllowListMapKey(screenNames), fullPath);
    return fullPath;
  }

  const { TabReferAFriend, TabInviteReward } = ETabReferFriendsRoutes;

  // fill in the route name as the key according to the route stacks order
  // Page: /main/tab-Home/TabHomeStack1
  const rules = {
    // [pagePath`${ERootRoutes.Main}${ETabRoutes.Home}${ETabHomeRoutes.TabHome}`]:
    //   {
    //     showUrl: true,
    //     showParams: true,
    //   },
    // Market Pages
    // [pagePath`${ERootRoutes.Main}${ETabRoutes.Market}${ETabMarketRoutes.TabMarket}`]:
    //   {
    //     showUrl: true,
    //     showParams: true,
    //   },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Market}${ETabMarketRoutes.MarketDetail}`]:
      {
        showUrl: true,
        showParams: true,
      },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Market}${ETabMarketRoutes.MarketDetailV2}`]:
      {
        showUrl: true,
        showParams: true,
      },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Market}${ETabMarketRoutes.MarketNativeDetail}`]:
      {
        showUrl: true,
        showParams: true,
      },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.ReferFriends}${TabReferAFriend}`]:
      { showUrl: true, showParams: false },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.ReferFriends}${TabInviteReward}`]:
      { showUrl: true, showParams: false },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Earn}`]: {
      showUrl: true,
      showParams: true,
    },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Market}`]: {
      showUrl: true,
      showParams: true,
    },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.StakingModal}${EModalStakingRoutes.ProtocolDetails}`]:
      {
        showUrl: true,
        showParams: true,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.StakingModal}${EModalStakingRoutes.ProtocolDetailsV2}`]:
      {
        showUrl: true,
        showParams: true,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.StakingModal}${EModalStakingRoutes.ManagePosition}`]:
      {
        showUrl: true,
        showParams: true,
      },
    // Page: /main/tab-Swap/TabSwap
    // Don't worry, the URL here is virtual, actually /swap.
    // it will automatically find the real route according to the route stacks.

    // Swap Pages
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Swap}${ETabSwapRoutes.TabSwap}`]:
      {
        showUrl: true,
        showParams: true,
      },

    [pagePath`${ERootRoutes.Onboarding}${EOnboardingV2Routes.OnboardingV2}${EOnboardingPagesV2.GetStarted}`]:
      {
        showUrl: true,
        showParams: true,
      },
    // Discovery Pages
    // [pagePath`${ERootRoutes.Main}${ETabRoutes.Discovery}${ETabDiscoveryRoutes.TabDiscovery}`]:
    //   {
    //     showUrl: true,
    //     showParams: true,
    //   },

    [pagePath`${ERootRoutes.Modal}${EModalRoutes.ReferFriendsModal}${EModalReferFriendsRoutes.ReferAFriend}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.SignatureConfirmModal}${EModalSignatureConfirmRoutes.TxConfirmFromDApp}`]:
      {
        showUrl: true,
        showParams: true,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.SignatureConfirmModal}${EModalSignatureConfirmRoutes.MessageConfirmFromDApp}`]:
      {
        showUrl: true,
        showParams: true,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.AppUpdateModal}${EAppUpdateRoutes.UpdatePreview}`]:
      {
        showUrl: true,
        showParams: true,
      },
    ...(perpTabShowWeb
      ? {
          [pagePath`${ERootRoutes.Main}${ETabRoutes.WebviewPerpTrade}`]: {
            showUrl: true,
            showParams: true,
          },
        }
      : {
          ...(!perpDisabled
            ? {
                [pagePath`${ERootRoutes.Main}${ETabRoutes.Perp}`]: {
                  showUrl: true,
                  showParams: true,
                },
              }
            : {}),
        }),
  } as Record<string, IAllowSettingItem>;

  if (platformEnv.isExtension) {
    // Permission WebUSB
    rules[pagePath`${ERootRoutes.PermissionWebDevice}`] = {
      showUrl: true,
      showParams: true,
    };
  }

  if (platformEnv.isDev) {
    Object.values(EGalleryRoutes).forEach((pageName) => {
      rules[pagePath`${ERootRoutes.Main}${ETabRoutes.Developer}${pageName}`] = {
        showUrl: true,
        showParams: true,
      };
    });
    // Developer Pages
    rules[
      pagePath`${ERootRoutes.Main}${ETabRoutes.Developer}${ETabDeveloperRoutes.TabDeveloper}`
    ] = {
      showUrl: true,
      showParams: true,
    };
    rules[
      pagePath`${ERootRoutes.Main}${ETabRoutes.Developer}${ETabDeveloperRoutes.DevHome}`
    ] = {
      showUrl: true,
      showParams: true,
    };

    rules[
      pagePath`${ERootRoutes.Main}${ETabRoutes.Developer}${ETabDeveloperRoutes.DevHomeStack1}`
    ] = {
      showUrl: true,
      showParams: true,
    };

    rules[
      pagePath`${ERootRoutes.Main}${ETabRoutes.Developer}${ETabDeveloperRoutes.DevHomeStack2}`
    ] = {
      showUrl: true,
      showParams: true,
    };

    rules[
      pagePath`${ERootRoutes.Modal}${EModalRoutes.TestModal}${ETestModalPages.TestSimpleModal}`
    ] = {
      showUrl: true,
      showParams: true,
    };
  }

  return rules;
};

export function buildModalRouteParams({
  screens = [],
  routeParams,
}: {
  screens: string[];
  routeParams: Record<string, any>;
}) {
  const modalParams: { screen: any; params: any } = {
    screen: null,
    params: {},
  };
  let paramsCurrent = modalParams;
  let paramsLast = modalParams;
  screens.forEach((screen) => {
    paramsCurrent.screen = screen;
    paramsCurrent.params = {};
    paramsLast = paramsCurrent;
    paramsCurrent = paramsCurrent.params;
  });
  paramsLast.params = routeParams;
  return modalParams;
}
