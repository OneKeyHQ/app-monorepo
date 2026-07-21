import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Stack, useIsDesktopModeUIInTabPages } from '@onekeyhq/components';
import DAppConnectExtensionFloatingTrigger from '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ExtOneKeyIdAuthOnMount } from '../../../components/OneKeyAuth/ExtOneKeyIdAuthOnMount';
import { TabletHomeContainer } from '../../../components/TabletHomeContainer';
import { ProviderJotaiContextAccountOverview } from '../../../states/jotai/contexts/accountOverview';
import {
  useAccountSelectorStorageInitDoneAtom,
  useActiveAccount,
  useIsAccountSelectorActiveAccountInitDone,
  useSelectedAccount,
  useSelectedAccountsAtom,
} from '../../../states/jotai/contexts/accountSelector';
import {
  ProviderJotaiContextHome,
  useHomeShell,
} from '../../../states/jotai/contexts/home';
import { useJotaiContextRootStore } from '../../../states/jotai/utils/useJotaiContextRootStore';
import { NotificationRegisterDaily } from '../../Notifications/components/NotificationRegisterDaily';
import {
  isMainHomeReadyToReveal,
  markCurrentHomeGenerationReady,
  useOnboardingLaunchSnapshot,
} from '../../Onboarding/components/onboardingLaunchGate';
import { KYTIntroOnMount } from '../../Setting/pages/Protection/KYTIntroDialog';
import { BTCFreshAddressProvider } from '../components/BTCFreshAddressProvider';
import { useHomeTokenListContextStoreInitData } from '../components/HomeTokenListProvider/HomeTokenListRootProvider';
import { HomeStoreSourceControllers } from '../model/react/HomeStoreSourceControllers';
import { isNativeHomeEnabled } from '../nativeHomeFeatureFlag';
import { NativeHomePageView } from '../NativeHomePageView';

import { EmptyWalletHomePage } from './EmptyWalletHomePage';
import {
  HomeBackgroundRecoveryRefreshProvider,
  useAcknowledgeHomeBackgroundRecoverySurfaceCommit,
} from './HomeBackgroundRecoveryRefreshProvider';
import { shouldMountHomeForegroundEffects } from './homeLaunchVisibility';
import { resolveHomeWalletContentReadiness } from './homePageNoWalletContent';
import { HomePageView } from './HomePageView';
import {
  HomeWalletListProvider,
  useHomeWalletList,
} from './HomeWalletListProvider';
import {
  type IHomeWalletPageSurfaceState,
  resolveHomeWalletPageSurface,
} from './homeWalletPageSurface';

const HOME_STORE_CONTEXT_CONFIG = {
  sceneId: EAccountSelectorSceneName.home,
} as const;

function EmptyRenderTest() {
  // console.log('AccountSelectorAtomChanged EmptyRenderTest render');
  return null;
}

function ActiveAccountTest() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activeAccount } = useActiveAccount({ num: 0 });
  // console.log('AccountSelectorAtomChanged activeAccount: ', activeAccount);
  return null;
}

function SelectedAccountTest() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { selectedAccount } = useSelectedAccount({
    num: 0,
    debugName: 'HomePage',
  });
  // console.log('AccountSelectorAtomChanged selectedAccount: ', selectedAccount);
  return null;
}

function SelectedAccountsMapTest() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedAccounts] = useSelectedAccountsAtom();
  // console.log(
  //   'AccountSelectorAtomChanged selectedAccountsMap: ',
  //   selectedAccounts,
  // );
  return null;
}

function HomeStoreDrivenWalletSurface({
  onPressHide,
  pageSurface,
  sceneName,
}: {
  onPressHide: () => void;
  pageSurface: IHomeWalletPageSurfaceState;
  sceneName: EAccountSelectorSceneName;
}) {
  const shell = useHomeShell();
  if (
    (pageSurface.surface === 'native' || pageSurface.surface === 'legacy') &&
    shell.value.kind === 'backupRequired'
  ) {
    return (
      <EmptyWalletHomePage
        key={`empty-wallet-${pageSurface.walletId ?? ''}`}
        variant="notBackedUp"
        sceneName={sceneName}
      />
    );
  }
  if (pageSurface.surface === 'native') {
    return (
      <NativeHomePageView
        key={`native-${sceneName}-${pageSurface.walletId ?? ''}`}
        sceneName={sceneName}
        onPressHide={onPressHide}
      />
    );
  }
  if (pageSurface.surface === 'legacy' || pageSurface.surface === 'no-wallet') {
    return (
      <HomePageView
        key={`${sceneName}-${pageSurface.walletId ?? pageSurface.surface}`}
        sceneName={sceneName}
        onPressHide={onPressHide}
      />
    );
  }
  return null;
}

export function HomeLaunchGatedContent({
  nativeHomeEnabled,
  sceneName,
  onPressHide,
}: {
  nativeHomeEnabled: boolean;
  sceneName: EAccountSelectorSceneName;
  onPressHide: () => void;
}) {
  const {
    activeAccount: { ready: activeAccountReady, wallet, account, network },
  } = useActiveAccount({ num: 0 });
  const { result: walletListResult, pending: walletListPending } =
    useHomeWalletList();
  const launchSnapshot = useOnboardingLaunchSnapshot();
  const [accountSelectorStorageInitDone] =
    useAccountSelectorStorageInitDoneAtom();
  const accountSelectorActiveAccountInitDone =
    useIsAccountSelectorActiveAccountInitDone(0);
  const hasNoUsableWallet = accountUtils.hasNoUsableWallet({
    wallet,
    account,
  });
  const walletContentReadiness = resolveHomeWalletContentReadiness({
    walletListPending,
    wallets: walletListResult?.wallets,
    hasNoUsableWallet,
    accountSelectorStorageInitDone,
    accountSelectorActiveAccountInitDone,
    activeAccountReady,
    activeWalletUnavailable: accountUtils.isWalletDeprecatedOrMocked(wallet),
    activeWalletId: wallet?.id,
  });
  const walletListWallet = walletListResult?.wallets.find(
    (item) => item.id === wallet?.id,
  );
  const shouldGateHome = platformEnv.isNative;
  // Non-native runtimes do not initialize the native onboarding launch gate.
  const surfaceLaunchDecision = shouldGateHome
    ? launchSnapshot.decision
    : 'main';
  const previousPageSurfaceRef = useRef<
    IHomeWalletPageSurfaceState | undefined
  >(undefined);
  const pageSurface = resolveHomeWalletPageSurface({
    launchDecision: surfaceLaunchDecision,
    walletContentReadiness,
    activeAccountId: account?.id,
    activeWallet: wallet,
    walletListWallet,
    nativeHomeEnabled,
    previous: previousPageSurfaceRef.current,
  });
  useAcknowledgeHomeBackgroundRecoverySurfaceCommit({
    owner: {
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
    },
    surfaceHasRenderer:
      pageSurface.surface === 'native' ||
      pageSurface.surface === 'legacy' ||
      pageSurface.surface === 'no-wallet',
  });
  useLayoutEffect(() => {
    previousPageSurfaceRef.current = pageSurface;
  }, [pageSurface]);
  const mainHomeReady = isMainHomeReadyToReveal({
    launchDecision: launchSnapshot.decision,
    accountSelectorStorageInitDone,
    accountSelectorActiveAccountInitDone,
    activeAccountReady,
    walletListReady: !walletListPending,
    activeWalletReady: pageSurface.surface !== 'pending',
  });
  const currentGenerationReady =
    launchSnapshot.readyHomeGeneration >= launchSnapshot.requiredHomeGeneration;
  const isHomeVisible =
    !shouldGateHome ||
    (launchSnapshot.decision === 'main' &&
      (currentGenerationReady || mainHomeReady));

  useEffect(() => {
    if (shouldGateHome && mainHomeReady) {
      markCurrentHomeGenerationReady(launchSnapshot.requiredHomeGeneration);
    }
  }, [launchSnapshot.requiredHomeGeneration, mainHomeReady, shouldGateHome]);

  return (
    <>
      <Stack
        flex={1}
        opacity={isHomeVisible ? 1 : 0}
        pointerEvents={isHomeVisible ? 'auto' : 'none'}
        accessibilityElementsHidden={!isHomeVisible}
        importantForAccessibility={
          isHomeVisible ? 'auto' : 'no-hide-descendants'
        }
      >
        <HomeStoreDrivenWalletSurface
          onPressHide={onPressHide}
          pageSurface={pageSurface}
          sceneName={sceneName}
        />
        {/* <UrlAccountAutoReplaceHistory num={0} /> */}

        {process.env.NODE_ENV !== 'production' ? (
          <>
            <SelectedAccountsMapTest />
            <SelectedAccountTest />
            <ActiveAccountTest />
            <EmptyRenderTest />
          </>
        ) : null}
      </Stack>
      {shouldMountHomeForegroundEffects({ isHomeVisible }) ? (
        <>
          <DAppConnectExtensionFloatingTrigger />
          <ExtOneKeyIdAuthOnMount />
          <NotificationRegisterDaily />
          <KYTIntroOnMount />
          <BTCFreshAddressProvider />
        </>
      ) : null}
    </>
  );
}

export function HomePageContainer() {
  const [isHide, setIsHide] = useState(false);
  const isDesktopModeUI = useIsDesktopModeUIInTabPages();
  const nativeHomeEnabled = isNativeHomeEnabled();
  const homeStoreData = useHomeTokenListContextStoreInitData();
  const homeStore = useJotaiContextRootStore(homeStoreData);
  const handlePressHide = useCallback(() => {
    setIsHide((value) => !value);
  }, []);

  useDebugComponentRemountLog({ name: 'HomePageContainer' });

  if (isHide) {
    return null;
  }
  const sceneName = EAccountSelectorSceneName.home;
  return (
    <TabletHomeContainer>
      <Stack
        flex={1}
        className="HomeRootTabPageContainer"
        bg={isDesktopModeUI ? '$bgSubdued' : '$bgApp'}
      >
        <ProviderJotaiContextHome
          config={HOME_STORE_CONTEXT_CONFIG}
          store={homeStore}
        >
          <AccountSelectorProviderMirror
            config={{
              sceneName,
              sceneUrl: '',
            }}
            enabledNum={[0]}
          >
            <HomeWalletListProvider>
              <HomeBackgroundRecoveryRefreshProvider>
                <HomeStoreSourceControllers enableWalletSources>
                  <HomeLaunchGatedContent
                    nativeHomeEnabled={nativeHomeEnabled}
                    sceneName={sceneName}
                    onPressHide={handlePressHide}
                  />
                </HomeStoreSourceControllers>
              </HomeBackgroundRecoveryRefreshProvider>
            </HomeWalletListProvider>
          </AccountSelectorProviderMirror>
        </ProviderJotaiContextHome>
      </Stack>
    </TabletHomeContainer>
  );
}

function useHomeAccountOverviewContextStoreInitData() {
  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.homeAccountOverview,
    }),
    [],
  );
  return data;
}

function HomePageContainerWithOverviewProvider() {
  const data = useHomeAccountOverviewContextStoreInitData();
  const store = useJotaiContextRootStore(data);
  return (
    <ProviderJotaiContextAccountOverview store={store}>
      <HomePageContainer />
    </ProviderJotaiContextAccountOverview>
  );
}

export default HomePageContainerWithOverviewProvider;
