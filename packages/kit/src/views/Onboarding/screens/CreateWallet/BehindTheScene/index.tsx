/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  PresenceTransition,
  TypeWriter,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import {
  closeExtensionWindowIfOnboardingFinished,
  useOnboardingDone,
} from '../../../../../hooks/useOnboardingRequired';
import { setEnableLocalAuthentication } from '../../../../../store/reducers/settings';
import { wait } from '../../../../../utils/helper';
import { savePassword } from '../../../../../utils/localAuthentication';
import { useOnboardingClose } from '../../../hooks';
import Layout from '../../../Layout';
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

type BehindTheSceneProps = {
  visible?: boolean;
};

const defaultProps = {} as const;

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
const BehindTheScene: FC<BehindTheSceneProps> = ({ visible }) => {
  const onboardingDone = useOnboardingDone();
  const route = useRoute<RouteProps>();
  const toast = useToast();
  const intl = useIntl();
  const { onboardingGoBack } = useOnboardingClose();
  const { password, mnemonic, withEnableAuthentication } = route.params;
  const isVerticalLayout = useIsVerticalLayout();

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
      {
        text: 'content__backing_up_to_icloud',
      },
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

  const startCreatingWallet = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceAccount.createHDWallet({
        password,
        mnemonic,
      });
      if (withEnableAuthentication) {
        backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
        await savePassword(password);
      }
      toast.show({ title: intl.formatMessage({ id: 'msg__account_created' }) });
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

  useEffect(() => {
    (async function () {
      if (await startCreatingWallet()) {
        handleWalletCreated();
      } else {
        onboardingGoBack();
      }
    })();
  }, [onboardingGoBack, handleWalletCreated, startCreatingWallet]);

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
    () => (
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
          transition: { duration: 150, delay: 150 },
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
        visible={visible}
        backButton={false}
        fullHeight
        secondaryContent={
          lastActionVisible && isVerticalLayout ? finishButton : undefined
        }
      >
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
                  { id: processInfo.text },
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
      {/* {showLastAction ? <PinPanel visible={showLastAction} /> : undefined} */}
    </>
  );
};

BehindTheScene.defaultProps = defaultProps;

export default React.memo(BehindTheScene);
