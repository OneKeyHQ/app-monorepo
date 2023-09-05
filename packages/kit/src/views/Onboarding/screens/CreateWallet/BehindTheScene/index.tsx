import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, ToastManager } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { SearchDevice } from '@onekeyhq/kit/src/utils/hardware';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { OneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import timelinePerfTrace, {
  ETimelinePerfNames,
} from '@onekeyhq/shared/src/perf/timelinePerfTrace';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../../hooks/useAppNavigation';
import { useDisableNavigationBack } from '../../../../../hooks/useDisableNavigationBack';
import { useOnboardingDone } from '../../../../../hooks/useOnboardingRequired';
import { setEnableLocalAuthentication } from '../../../../../store/reducers/settings';
import { getTimeDurationMs, wait } from '../../../../../utils/helper';
import { savePassword } from '../../../../../utils/localAuthentication';
import { useOnboardingClose } from '../../../hooks';
import Layout from '../../../Layout';
import { useOnboardingContext } from '../../../OnboardingContext';

import {
  ONBOARDING_PAUSED_INDEX_HARDWARE,
  ONBOARDING_PAUSED_INDEX_SOFTWARE,
} from './consts';
import ProcessAutoTyping from './ProcessAutoTyping';
import ProcessAutoTypingWebView from './ProcessAutoTypingWebView';

import type { EOnboardingRoutes } from '../../../routes/enums';
import type {
  IOnboardingBehindTheSceneParams,
  IOnboardingRoutesParams,
} from '../../../routes/types';
import type { IProcessAutoTypingRef } from './ProcessAutoTyping';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type NavigationProps = StackNavigationProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.BehindTheScene
>;
type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.BehindTheScene
>;

function BehindTheSceneCreatingWallet({
  routeParams,
  handleWalletCreated,
  shouldStartCreating,
  onPressOnboardingFinished,
  setIsNavBackDisabled,
}: {
  routeParams: IOnboardingBehindTheSceneParams;
  handleWalletCreated: () => void;
  shouldStartCreating: boolean;
  onPressOnboardingFinished?: () => Promise<void>;
  setIsNavBackDisabled?: (b: boolean) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { onboardingGoBack } = useOnboardingClose();
  const {
    password,
    mnemonic,
    withEnableAuthentication,
    isHardwareCreating,
    entry,
  } = routeParams;

  const context = useOnboardingContext();
  const forceVisibleUnfocused = context?.forceVisibleUnfocused;

  const startCreatingHardwareWallet = useCallback(async () => {
    try {
      const device: SearchDevice | undefined = isHardwareCreating?.device;
      const features: IOneKeyDeviceFeatures | undefined =
        isHardwareCreating?.features;
      if (!device || !features) {
        return false;
      }

      await backgroundApiProxy.serviceAccount.createHWWallet({
        features,
        connectId: device.connectId ?? '',
      });

      // safeGoBack();

      forceVisibleUnfocused?.();

      // NOT need show Hardware setup success modal anymore
      /*
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.SetupSuccessModal,
          params: {
            device,
            onPressOnboardingFinished,
          },
        },
      });
      */

      return true;
    } catch (e: any) {
      debugLogger.common.error(e);
      if (navigation.canGoBack?.() && entry === 'walletSelector') {
        debugLogger.common.info('go back when entry is wallet selector');
        setTimeout(() => navigation.goBack(), 300);
      }
      const { className, message, data } = e || {};
      if (className === OneKeyErrorClassNames.OneKeyAlreadyExistWalletError) {
        setTimeout(() => {
          const { walletName: existsWalletName } = data || {};
          if (existsWalletName) {
            ToastManager.show(
              {
                title: intl.formatMessage(
                  { id: 'msg__wallet_already_exist_activated_automatically' },
                  { 0: existsWalletName },
                ),
              },
              { type: 'default' },
            );
          }
          // await onboarding close and then go to home
        }, 600 + 500);

        onPressOnboardingFinished?.();
      } else if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
        deviceUtils.showErrorToast(e);
      } else {
        ToastManager.show(
          {
            title: message,
          },
          {
            type: 'default',
          },
        );
      }
    }
    return false;
  }, [
    isHardwareCreating?.device,
    isHardwareCreating?.features,
    forceVisibleUnfocused,
    onPressOnboardingFinished,
    intl,
    navigation,
    entry,
  ]);

  const startCreatingHDWallet = useCallback(async () => {
    if (!password || !mnemonic) {
      return false;
    }
    try {
      // wait first typing animation start
      await wait(300); // 1500, 300
      const p1 = performance.now();
      debugLogger.onBoarding.info('startCreatingHDWallet');

      timelinePerfTrace.clear(ETimelinePerfNames.createHDWallet);
      timelinePerfTrace.mark({
        name: ETimelinePerfNames.createHDWallet,
        title: 'onboarding.createHDWallet >> start ===========================',
      });
      await backgroundApiProxy.serviceAccount.createHDWallet({
        password,
        mnemonic,
        dispatchActionDelay: 300, // should dispatchAction before postCreated
        postCreatedDelay: 600,
      });

      timelinePerfTrace.mark({
        name: ETimelinePerfNames.createHDWallet,
        title: 'onboarding.createHDWallet >> createHDWallet DONE',
      });

      if (withEnableAuthentication) {
        backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
        savePassword(password);
      }
      if (platformEnv.isDev) {
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__account_created' }),
        });
      }
      const p2 = performance.now();
      timelinePerfTrace.mark({
        name: ETimelinePerfNames.createHDWallet,
        title: 'onboarding.createHDWallet >> end',
      });
      debugLogger.onBoarding.info(
        'startCreatingHDWallet done!',
        Math.round(p2 - p1),
      );
      return true;
    } catch (e) {
      debugLogger.common.error(e);
      const errorKey = (e as { key: LocaleIds }).key;
      ToastManager.show(
        { title: intl.formatMessage({ id: errorKey }) },
        { type: 'error' },
      );
    }
    return false;
  }, [intl, mnemonic, password, withEnableAuthentication]);

  useEffect(() => {
    (async function () {
      if (!shouldStartCreating) {
        return;
      }
      if (!forceVisibleUnfocused) {
        return;
      }
      let result = false;
      if (isHardwareCreating) {
        result = await startCreatingHardwareWallet();
      } else {
        result = await startCreatingHDWallet();
      }
      if (result) {
        handleWalletCreated();
      } else {
        setIsNavBackDisabled?.(false);
        setTimeout(() => onboardingGoBack(), 600);
      }
    })();
  }, [
    setIsNavBackDisabled,
    forceVisibleUnfocused,
    onboardingGoBack,
    handleWalletCreated,
    startCreatingHDWallet,
    isHardwareCreating,
    startCreatingHardwareWallet,
    shouldStartCreating,
  ]);

  return null;
}

const BehindTheSceneCreatingWalletMemo = memo(BehindTheSceneCreatingWallet);

const BehindTheScene = () => {
  const onboardingDone = useOnboardingDone();
  const route = useRoute<RouteProps>();
  const routeParams = route.params || {};
  const [isNavBackDisabled, setIsNavBackDisabled] = useState(true);
  useDisableNavigationBack({ condition: isNavBackDisabled });
  const typingRef = useRef<IProcessAutoTypingRef | null>(null);
  // const isRenderAsWebview = platformEnv.isNative;
  const isRenderAsWebview = platformEnv.isNative && !platformEnv.isDev;
  const [showCloseButton, setShowCloseButton] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () => setShowCloseButton(true),
      getTimeDurationMs({ minute: 1 }),
    );

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const [shouldStartCreating, setShouldStartCreating] = useState(
    !isRenderAsWebview,
  );

  const pausedProcessIndex = routeParams?.isHardwareCreating
    ? ONBOARDING_PAUSED_INDEX_HARDWARE
    : ONBOARDING_PAUSED_INDEX_SOFTWARE;

  const handleWalletCreatedIntervalRef = useRef<number | undefined>();

  const handleWalletCreated = useCallback(() => {
    debugLogger.onBoarding.info('Wallet Created Success !!!!');
    if (typingRef.current) {
      typingRef.current.handleWalletCreated();
    }
    clearInterval(handleWalletCreatedIntervalRef.current);
    // @ts-expect-error
    handleWalletCreatedIntervalRef.current = setInterval(() => {
      debugLogger.onBoarding.info('handleWalletCreated interval recheck');
      if (
        typingRef &&
        typingRef.current &&
        typingRef.current.handleWalletCreated
      ) {
        typingRef.current.handleWalletCreated();
      }
    }, 3000);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      clearInterval(handleWalletCreatedIntervalRef.current);
    }, 3 * 60 * 1000);
    return () => {
      clearInterval(handleWalletCreatedIntervalRef.current);
      clearTimeout(timer);
    };
  }, []);

  const onPressFinished = useCallback(async () => {
    setIsNavBackDisabled(false);
    if (platformEnv.isExtension) {
      // await wait(1000);
      // window.close();
      await onboardingDone({ delay: 600 });
    } else {
      await onboardingDone({ delay: 600 });
    }
  }, [onboardingDone]);

  const webviewAutoTyping = useMemo(() => {
    if (!isRenderAsWebview) {
      return null;
    }
    return (
      <Box flex={1} h="full" w="full">
        <ProcessAutoTypingWebView
          ref={typingRef}
          onContentLoaded={() => setShouldStartCreating(true)}
          onPressFinished={onPressFinished}
          pausedProcessIndex={pausedProcessIndex}
        />
      </Box>
    );
  }, [isRenderAsWebview, onPressFinished, pausedProcessIndex]);

  const builtInAutoTyping = useMemo(() => {
    if (isRenderAsWebview) {
      return null;
    }
    return (
      <ProcessAutoTyping
        ref={typingRef}
        onPressFinished={onPressFinished}
        pausedProcessIndex={pausedProcessIndex}
      />
    );
  }, [isRenderAsWebview, onPressFinished, pausedProcessIndex]);
  return (
    <Layout backButton={false} showCloseButton={showCloseButton} fullHeight>
      <BehindTheSceneCreatingWalletMemo
        routeParams={routeParams}
        handleWalletCreated={handleWalletCreated}
        shouldStartCreating={shouldStartCreating}
        onPressOnboardingFinished={onPressFinished}
        setIsNavBackDisabled={setIsNavBackDisabled}
      />
      {isRenderAsWebview ? (
        <Center h="full" w="full">
          {webviewAutoTyping}
        </Center>
      ) : (
        <Box
          flex={1}
          h="full"
          w="full"
          // TODO how to make webview fullscreen?
          minH={{ base: 480, sm: 320 }}
          justifyContent="flex-end"
        >
          {builtInAutoTyping}
        </Box>
      )}
    </Layout>
  );
};

export default memo(BehindTheScene);
