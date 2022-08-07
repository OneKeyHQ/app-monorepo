/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import { RouteProp, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';

import { Box, Center, ToastManager, useToast } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { SearchDevice } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger, {
  LoggerNames,
} from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { WebViewWebEmbed } from '../../../../../components/WebView/WebViewWebEmbed';
import useAppNavigation from '../../../../../hooks/useAppNavigation';
import { useDisableNavigationBack } from '../../../../../hooks/useDisableNavigationBack';
import { useOnboardingDone } from '../../../../../hooks/useOnboardingRequired';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../../routes/routesEnum';
import { setEnableLocalAuthentication } from '../../../../../store/reducers/settings';
import { wait } from '../../../../../utils/helper';
import { savePassword } from '../../../../../utils/localAuthentication';
import { useOnboardingClose } from '../../../hooks';
import Layout from '../../../Layout';
import { useOnboardingContext } from '../../../OnboardingContext';
import { EOnboardingRoutes } from '../../../routes/enums';
import {
  IOnboardingBehindTheSceneParams,
  IOnboardingRoutesParams,
} from '../../../routes/types';

import {
  ONBOARDING_PAUSED_INDEX_HARDWARE,
  ONBOARDING_PAUSED_INDEX_SOFTWARE,
} from './consts';
import ProcessAutoTyping, { IProcessAutoTypingRef } from './ProcessAutoTyping';
import ProcessAutoTypingWebView from './ProcessAutoTypingWebView';

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
}: {
  routeParams: IOnboardingBehindTheSceneParams;
  handleWalletCreated: () => void;
}) {
  const toast = useToast();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { onboardingGoBack } = useOnboardingClose();
  const { password, mnemonic, withEnableAuthentication, isHardwareCreating } =
    routeParams;

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
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.SetupSuccessModal,
          params: { device },
        },
      });

      return true;
    } catch (e: any) {
      // safeGoBack();

      const { className, key, message } = e || {};

      if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
        ToastManager.show(
          {
            title: intl.formatMessage({ id: key }),
          },
          {
            type: 'error',
          },
        );
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
    forceVisibleUnfocused,
    isHardwareCreating?.device,
    isHardwareCreating?.features,
    intl,
    navigation,
  ]);

  const startCreatingHDWallet = useCallback(async () => {
    if (!password || !mnemonic) {
      return false;
    }
    try {
      await wait(10 * 1000);
      // wait first typing animation start
      await wait(1500); // 1500, 300
      await backgroundApiProxy.serviceAccount.createHDWallet({
        password,
        mnemonic,
      });
      await wait(300);
      if (withEnableAuthentication) {
        backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
        await savePassword(password);
      }
      if (platformEnv.isDev) {
        toast.show({
          title: intl.formatMessage({ id: 'msg__account_created' }),
        });
      }
      return true;
    } catch (e) {
      debugLogger.common.error(e);
      const errorKey = (e as { key: LocaleIds }).key;
      toast.show(
        { title: intl.formatMessage({ id: errorKey }) },
        { type: 'error' },
      );
    }
    return false;
  }, [intl, mnemonic, password, toast, withEnableAuthentication]);

  useEffect(() => {
    (async function () {
      if (!forceVisibleUnfocused) {
        return;
      }
      console.log('BehindTheScene >>>>> creating wallet');
      let result = false;
      if (isHardwareCreating) {
        result = await startCreatingHardwareWallet();
      } else {
        result = await startCreatingHDWallet();
      }
      if (result) {
        handleWalletCreated();
      } else {
        onboardingGoBack();
      }
    })();
  }, [
    forceVisibleUnfocused,
    onboardingGoBack,
    handleWalletCreated,
    startCreatingHDWallet,
    isHardwareCreating,
    startCreatingHardwareWallet,
  ]);

  return null;
}

const BehindTheScene = () => {
  const onboardingDone = useOnboardingDone();
  const route = useRoute<RouteProps>();
  const routeParams = route.params || {};
  const [isNavBackDisabled, setIsNavBackDisabled] = useState(true);
  useDisableNavigationBack({ condition: isNavBackDisabled });
  const typingRef = useRef<IProcessAutoTypingRef | null>(null);

  const pausedProcessIndex = routeParams?.isHardwareCreating
    ? ONBOARDING_PAUSED_INDEX_HARDWARE
    : ONBOARDING_PAUSED_INDEX_SOFTWARE;

  const handleWalletCreated = useCallback(() => {
    debugLogger.onBoarding.info('Wallet Created Success !!!!');
    if (typingRef.current) {
      typingRef.current.handleWalletCreated();
    }
  }, []);

  const onPressFinished = useCallback(async () => {
    setIsNavBackDisabled(false);
    if (platformEnv.isExtension) {
      await wait(1000);
      window.close();
    } else {
      await onboardingDone({ delay: 600 });
    }
  }, [onboardingDone]);

  const isRenderAsWebview = platformEnv.isNative;

  const webviewAutoTyping = useMemo(() => {
    if (!isRenderAsWebview) {
      return null;
    }
    return (
      <Box flex={1} h="full" w="full">
        <ProcessAutoTypingWebView
          ref={typingRef}
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
    <>
      <Layout backButton={false} showCloseButton={false} fullHeight>
        <BehindTheSceneCreatingWallet
          routeParams={routeParams}
          handleWalletCreated={handleWalletCreated}
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
    </>
  );
};

export default React.memo(BehindTheScene);
