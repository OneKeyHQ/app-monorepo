import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EAccountManagerStacksRoutes } from '../../views/AccountManagerStacks/router/types';
import { EGalleryRoutes } from '../../views/Developer/pages/routes';
import { ETabDeveloperRoutes } from '../../views/Developer/type';
import { ETabHomeRoutes } from '../../views/Home/router';
import { EOnboardingPages } from '../../views/Onboarding/router/type';
import { EModalSettingRoutes } from '../../views/Setting/router/types';
import { ETestModalPages } from '../../views/TestModal/router/type';
import { ERootRoutes } from '../enum';
import { EModalRoutes } from '../Modal/type';
import { ETabDiscoveryRoutes } from '../Tab/Discovery/type';
import { ETabMeRoutes } from '../Tab/Me/type';
import { ETabSwapRoutes } from '../Tab/Swap/type';
import { ETabRoutes } from '../Tab/type';

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

export const buildAllowList = (screens: IScreenPathConfig) => {
  function pagePath(_: TemplateStringsArray, ...screenNames: string[]): string {
    let screenConfig = screens;
    const path = screenNames.reduce((prev, screenName) => {
      const screen = screenConfig[screenName];
      if (platformEnv.isDev) {
        if (!screen) {
          throw new Error(`screen ${screenName} not found`);
        }
      }
      const nextScreenConfig = screen.screens;
      if (nextScreenConfig) {
        screenConfig = nextScreenConfig;
      }
      const screenPath = removeExtraSlash(screen.path);
      // if the path is rewritten path, the full path will be rewritten.
      return screen.exact ? screenPath : addPath(prev, screenPath);
    }, '');
    return `/${path}`;
  }

  // fill in the route name as the key according to the route stacks order
  // Page: /main/tab-Home/TabHomeStack1
  const rules = {
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Home}${ETabHomeRoutes.TabHome}`]:
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

    // Discovery Pages
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Discovery}${ETabDiscoveryRoutes.TabDiscovery}`]:
      {
        showUrl: true,
        showParams: true,
      },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Discovery}${ETabDiscoveryRoutes.TabDiscovery}`]:
      {
        showUrl: true,
        showParams: true,
      },

    // Me Pages
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Me}${ETabMeRoutes.TabMe}`]: {
      showUrl: true,
      showParams: true,
    },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.SettingModal}${EModalSettingRoutes.SettingListModal}`]:
      {
        showUrl: true,
        showParams: true,
      },

    // AccountSelector Pages
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.AccountManagerStacks}${EAccountManagerStacksRoutes.AccountSelectorStack}`]:
      {
        showUrl: true,
        showParams: true,
      },

    // Onboarding Pages
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.ActivateDevice}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.BeforeShowRecoveryPhrase}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.ConnectWallet}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.ConnectYourDevice}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.FinalizeWalletSetup}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.GetStarted}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.ImportAddress}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.ImportPrivateKey}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.ImportRecoveryPhrase}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.ImportWalletOptions}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.OneKeyHardwareWallet}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.RecoveryPhrase}`]:
      {
        showUrl: true,
        showParams: false,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.OnboardingModal}${EOnboardingPages.VerifyRecoverPhrase}`]:
      {
        showUrl: true,
        showParams: false,
      },
  } as Record<string, IAllowSettingItem>;

  if (platformEnv.isDev) {
    Object.values(EGalleryRoutes).forEach((pageName) => {
      console.log(
        pagePath`${ERootRoutes.Main}${ETabRoutes.Developer}${pageName}`,
      );
      rules[pagePath`${ERootRoutes.Main}${ETabRoutes.Developer}${pageName}`] = {
        showUrl: true,
        showParams: true,
      };
    });
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
