import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  OverlayContainer,
  PresenceTransition,
  Pressable,
  TypeWriter,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ONBOARDING_CREATED_EVENT_NAME,
  ONBOARDING_PROCESS_DELAY,
  ONBOARDING_PROCESS_INFO_LIST,
} from './consts';
import PinPanel from './PinPanel';

export type IProcessStateInfo = {
  typingEnd: boolean;
  done: boolean;
};
export type IProcessStateInfoUpdate = {
  typingEnd?: boolean;
  done?: boolean;
};
export type IProcessStates = Record<number, IProcessStateInfo>;
export type IProcessInfo = { text: string };

export type IProcessAutoTypingProps = {
  onPressFinished: (...args: any[]) => Promise<void>;
  pausedProcessIndex: number;
  forwardedRef?: any;
  minHeight?: number;
};
export type IProcessAutoTypingRef = {
  handleWalletCreated: () => void;
};
function ProcessAutoTyping({
  onPressFinished,
  pausedProcessIndex,
  forwardedRef,
  minHeight,
}: IProcessAutoTypingProps) {
  const intl = useIntl();

  const emitter = useRef(new CrossEventEmitter());
  const isWalletCreatedRef = useRef(false);
  const [showLastAction, setIsShowLastAction] = useState(false);
  const isVerticalLayout = useIsVerticalLayout();
  const { processInfoList, processDefaultStates } = useMemo(() => {
    const list: Array<IProcessInfo> = ONBOARDING_PROCESS_INFO_LIST;
    const defaultStates = list.reduce<IProcessStates>(
      (prev, current, index) => {
        prev[index] = { typingEnd: false, done: false };
        return prev;
      },
      {},
    );
    return { processInfoList: list, processDefaultStates: defaultStates };
  }, []);
  const pausedIndex = useMemo(() => {
    if (pausedProcessIndex <= 0) {
      return 0;
    }
    if (pausedProcessIndex >= processInfoList.length - 1) {
      return processInfoList.length - 1;
    }
    return pausedProcessIndex;
  }, [pausedProcessIndex, processInfoList.length]);

  const [processStates, setProcessStates] =
    useState<IProcessStates>(processDefaultStates);
  const lastProcessIndex = processInfoList.length - 1;

  const [processFinalTypingEnd, setIsProcessFinalTypingEnd] = useState(false);

  const lastProcessStatus = useMemo(
    () => processStates[lastProcessIndex],
    [lastProcessIndex, processStates],
  );

  const scrollToBottom = useCallback(() => {
    if (platformEnv.isRuntimeBrowser) {
      setTimeout(() => {
        window.scrollTo(0, 999999);
        document
          .querySelector('#WebOnboardingAutoTypingContainer')
          ?.scrollTo(0, 999999);
      }, 0);
    }
  }, []);

  const handleProcessFinalTypingEnd = useCallback(() => {
    setIsProcessFinalTypingEnd(true);
    scrollToBottom();
  }, [scrollToBottom]);

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

  const lastActionVisible = useMemo(
    () => showLastAction && isAllProcessDone && processFinalTypingEnd,
    [isAllProcessDone, processFinalTypingEnd, showLastAction],
  );

  useEffect(() => {
    if (lastActionVisible) {
      scrollToBottom();
    }
  }, [lastActionVisible, scrollToBottom]);

  const typingEndExecutedRef = useRef<Partial<Record<number, boolean>>>({});

  const handleTypingEnd = useCallback(
    (index: number) => {
      if (typingEndExecutedRef.current[index]) {
        return;
      }
      typingEndExecutedRef.current[index] = true;

      updateProcessState(index, { typingEnd: true });

      scrollToBottom();

      setTimeout(() => {
        if (index !== pausedIndex || isWalletCreatedRef.current) {
          updateProcessState(index, { done: true });
        } else {
          emitter.current.once(ONBOARDING_CREATED_EVENT_NAME, () => {
            updateProcessState(index, { done: true });
          });
        }
        scrollToBottom();
      }, ONBOARDING_PROCESS_DELAY);
    },
    [pausedIndex, updateProcessState, scrollToBottom],
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
          transition: { duration: 300, delay: 150 },
        }}
      >
        <Button
          onPromise={onPressFinished}
          type={platformEnv.isExtension ? 'basic' : 'primary'}
          size="xl"
          minW={160}
        >
          {intl.formatMessage({
            id: platformEnv.isExtension
              ? 'action__i_got_it'
              : 'action__lets_go',
          })}
        </Button>
      </PresenceTransition>
    ),
    [lastActionVisible, onPressFinished, intl],
  );

  const handleWalletCreated = useCallback(() => {
    if (isWalletCreatedRef.current) {
      return;
    }
    // TODO completeAllProcess in webview
    // completeAllProcess instantly if wallet created faster than typing animations
    // completeAllProcess()

    isWalletCreatedRef.current = true;

    // updateProcessState(pausedIndex, { done: true });
    // updateProcessState(lastProcessIndex, { done: true });

    emitter.current.emit(ONBOARDING_CREATED_EVENT_NAME);

    setTimeout(() => {
      setIsShowLastAction(true);
      scrollToBottom();
    }, 300);
  }, [scrollToBottom]);

  useImperativeHandle(
    forwardedRef,
    (): IProcessAutoTypingRef => ({
      handleWalletCreated,
    }),
  );

  const normalText = useCallback(
    (text) => <TypeWriter.NormalText>{text}</TypeWriter.NormalText>,
    [],
  );
  const highlightText = useCallback(
    (text) => <TypeWriter.Highlight>{text}</TypeWriter.Highlight>,
    [],
  );

  return (
    <>
      <Box
        minH={minHeight ?? { base: 480, sm: 320 }}
        maxH="full"
        flexGrow={{ base: 1, sm: 0 }}
      >
        <Box flex={1} justifyContent="flex-end" mb={{ base: 12, sm: 0 }}>
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
                    a: normalText,
                    b: highlightText,
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
            <Pressable onPress={onPressFinished}>
              <TypeWriter
                isPending={!lastProcessStatus.done}
                onTypingEnd={handleProcessFinalTypingEnd}
              >
                <TypeWriter.NormalText>
                  {intl.formatMessage(
                    { id: 'content__your_wallet_is_now_ready' },
                    {
                      b: highlightText,
                    },
                  )}{' '}
                  🚀
                </TypeWriter.NormalText>
              </TypeWriter>
            </Pressable>
          ) : undefined}
          {processFinalTypingEnd ? <TypeWriter /> : undefined}
        </Box>

        <Box
          mt={platformEnv.isExtension && isVerticalLayout ? 4 : 16}
          minH="50px"
        >
          {lastActionVisible ? finishButton : undefined}
        </Box>
      </Box>

      <OverlayContainer>
        {lastActionVisible && platformEnv.isExtension && !isVerticalLayout ? (
          <PinPanel visible={lastActionVisible} />
        ) : undefined}
      </OverlayContainer>
    </>
  );
}

const ProcessAutoTypingRef = forwardRef<
  IProcessAutoTypingRef,
  IProcessAutoTypingProps
>(({ ...props }, ref) => <ProcessAutoTyping {...props} forwardedRef={ref} />);

ProcessAutoTypingRef.displayName = 'ProcessAutoTypingRef';

export default ProcessAutoTypingRef;
