/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  PresenceTransition,
  ToastManager,
  TypeWriter,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { SearchDevice } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../../hooks/useAppNavigation';
import { useDisableNavigationBack } from '../../../../../hooks/useDisableNavigationBack';
import {
  closeExtensionWindowIfOnboardingFinished,
  useOnboardingDone,
} from '../../../../../hooks/useOnboardingRequired';
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
import { IOnboardingRoutesParams } from '../../../routes/types';

import PinPanel from './PinPanel';

type NavigationProps = StackNavigationProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.BehindTheScene
>;
type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.BehindTheScene
>;

// const defaultDelay = 5000; // creating faster than animation
// const defaultDelay = 0; // creating slower than animation
const defaultDelay = 1000;

type IProcessStateInfo = {
  typingEnd: boolean;
  done: boolean;
};
type IProcessStateInfoUpdate = {
  typingEnd?: boolean;
  done?: boolean;
};
type IProcessStates = Record<number, IProcessStateInfo>;
type IProcessInfo = { text: string };

function BehindTheSceneCreatingWallet({
  handleWalletCreated,
}: {
  handleWalletCreated: () => void;
}) {
  const toast = useToast();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { onboardingGoBack } = useOnboardingClose();
  const route = useRoute<RouteProps>();
  const { password, mnemonic, withEnableAuthentication, hardwareCreating } =
    route.params || {};

  const context = useOnboardingContext();
  const forceVisibleUnfocused = context?.forceVisibleUnfocused;

  const startCreatingHardwareWallet = useCallback(async () => {
    try {
      const device: SearchDevice | undefined = hardwareCreating?.device;
      const features: IOneKeyDeviceFeatures | undefined =
        hardwareCreating?.features;
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
    hardwareCreating?.device,
    hardwareCreating?.features,
    intl,
    navigation,
  ]);

  const startCreatingHDWallet = useCallback(async () => {
    if (!password || !mnemonic) {
      return false;
    }
    try {
      await wait(1500);
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
      if (hardwareCreating) {
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
    hardwareCreating,
    startCreatingHardwareWallet,
  ]);

  return null;
}

const BehindTheScene = () => {
  const onboardingDone = useOnboardingDone();
  const toast = useToast();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { onboardingGoBack } = useOnboardingClose();

  const isVerticalLayout = useIsVerticalLayout();
  useDisableNavigationBack({ condition: true });

  const isWalletCreatedRef = useRef(false);

  const { processInfoList, processDefaultStates } = useMemo(() => {
    const list: Array<IProcessInfo> = [
      {
        text: 'content__creating_your_wallet',
      },
      {
        text: 'content__generating_your_accounts',
      },
      {
        text: 'content__encrypting_your_data',
      },
      // {
      //   text: 'content__backing_up_to_icloud',
      // },
    ];
    const defaultStates = list.reduce<IProcessStates>(
      (prev, current, index) => {
        prev[index] = { typingEnd: false, done: false };
        return prev;
      },
      {},
    );
    return { processInfoList: list, processDefaultStates: defaultStates };
  }, []);
  const [processStates, setProcessStates] =
    useState<IProcessStates>(processDefaultStates);
  const lastProcessIndex = processInfoList.length - 1;

  const [processFinalTypingEnd, setIsProcessFinalTypingEnd] = useState(false);

  const [showLastAction, setIsShowLastAction] = useState(false);

  const lastProcessStatus = useMemo(
    () => processStates[lastProcessIndex],
    [lastProcessIndex, processStates],
  );

  const handleProcessFinalTypingEnd = useCallback(() => {
    setIsProcessFinalTypingEnd(true);
  }, []);

  const isAllProcessDone = useMemo(() => {
    let isDone = true;
    Object.values(processStates).forEach((item) => {
      isDone = isDone && item.done;
    });
    return isDone;
  }, [processStates]);

  const updateProcessState = useCallback(
    (index: number, state: IProcessStateInfoUpdate) => {
      setProcessStates((states) => ({
        ...states,
        [index]: {
          ...states[index],
          ...state,
        },
      }));
    },
    [],
  );

  const completeAllProcess = useCallback(() => {
    //
  }, []);

  const handleWalletCreated = useCallback(() => {
    // completeAllProcess instantly if wallet created faster than typing animations
    // completeAllProcess()

    isWalletCreatedRef.current = true;

    updateProcessState(lastProcessIndex, { done: true });

    setTimeout(() => {
      setIsShowLastAction(true);
    }, 300);
  }, [lastProcessIndex, updateProcessState]);

  const lastActionVisible = useMemo(
    () => showLastAction && isAllProcessDone && processFinalTypingEnd,
    [isAllProcessDone, processFinalTypingEnd, showLastAction],
  );

  const typingEndExecutedRef = useRef<Partial<Record<number, boolean>>>({});
  const handleTypingEnd = useCallback(
    (index: number) => {
      if (typingEndExecutedRef.current[index]) {
        return;
      }
      typingEndExecutedRef.current[index] = true;

      updateProcessState(index, { typingEnd: true });

      setTimeout(() => {
        if (index !== lastProcessIndex || isWalletCreatedRef.current) {
          updateProcessState(index, { done: true });
        }
      }, defaultDelay);
    },
    [lastProcessIndex, updateProcessState],
  );

  const tyingEndCallbacks = useMemo(
    () => processInfoList.map((_, index) => () => handleTypingEnd(index)),
    [handleTypingEnd, processInfoList],
  );

  const finishButton = useMemo(
    () =>
      platformEnv.isExtension ? null : (
        <PresenceTransition
          as={Box}
          // @ts-ignore
          mt="auto"
          alignSelf={{ base: 'stretch', sm: 'flex-start' }}
          visible={lastActionVisible}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1,
            scale: 1,
            transition: { duration: 300, delay: 150 },
          }}
        >
          <Button
            onPromise={() => onboardingDone({ delay: 600 })}
            type="primary"
            size="xl"
            minW={160}
          >
            Let's go
          </Button>
        </PresenceTransition>
      ),
    [lastActionVisible, onboardingDone],
  );

  return (
    <>
      <Layout
        backButton={false}
        fullHeight
        secondaryContent={
          lastActionVisible && isVerticalLayout ? finishButton : undefined
        }
      >
        <BehindTheSceneCreatingWallet
          handleWalletCreated={handleWalletCreated}
        />
        <Box minH={{ base: 480, sm: 320 }} justifyContent="flex-end">
          {processInfoList.map((processInfo, index) => {
            const prevProcessState: IProcessStateInfo | undefined =
              processStates[index - 1];
            const processState: IProcessStateInfo | undefined =
              processStates[index];

            let isPending = false;
            let isFadeOut = false;
            if (prevProcessState) {
              isPending = !prevProcessState.done;
            }
            if (processState) {
              isFadeOut = processState.done && processState.typingEnd;
            }

            if (prevProcessState && !prevProcessState.typingEnd) {
              return undefined;
            }

            return (
              <TypeWriter
                key={index}
                onTypingEnd={tyingEndCallbacks[index]}
                isPending={isPending}
                isFadeOut={isFadeOut}
              >
                {intl.formatMessage(
                  { id: processInfo.text as any },
                  {
                    a: (text) => (
                      <TypeWriter.NormalText>{text}</TypeWriter.NormalText>
                    ),
                    b: (text) => (
                      <TypeWriter.Highlight>{text}</TypeWriter.Highlight>
                    ),
                  },
                )}
              </TypeWriter>
            );
          })}

          {lastProcessStatus.typingEnd && !isAllProcessDone ? (
            <TypeWriter />
          ) : undefined}

          {/* process5 */}
          {lastProcessStatus.typingEnd && isAllProcessDone ? (
            <TypeWriter
              isPending={!lastProcessStatus.done}
              onTypingEnd={handleProcessFinalTypingEnd}
            >
              <TypeWriter.NormalText>
                {intl.formatMessage(
                  { id: 'content__your_wallet_is_now_ready' },
                  {
                    b: (text) => (
                      <TypeWriter.Highlight>{text}</TypeWriter.Highlight>
                    ),
                  },
                )}{' '}
                🚀
              </TypeWriter.NormalText>
            </TypeWriter>
          ) : undefined}

          {processFinalTypingEnd ? <TypeWriter /> : undefined}

          {lastActionVisible && !isVerticalLayout ? (
            <Box mt={16}>{finishButton}</Box>
          ) : undefined}
        </Box>
      </Layout>
      {lastActionVisible && platformEnv.isExtension ? (
        <PinPanel visible={lastActionVisible} />
      ) : undefined}
    </>
  );
};

export default React.memo(BehindTheScene);
