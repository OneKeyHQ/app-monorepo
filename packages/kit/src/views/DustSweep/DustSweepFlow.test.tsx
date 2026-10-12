/** @jest-environment jsdom */
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import type { ComponentType, PropsWithChildren, ReactNode } from 'react';

import {
  BaseNavigationContainer,
  CommonActions,
  type ParamListBase,
  StackRouter,
  createNavigationContainerRef,
  createNavigatorFactory,
  useIsFocused,
  useNavigation,
  useNavigationBuilder,
} from '@react-navigation/core';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDustSweepSnapshot } from '@onekeyhq/shared/types/swap/dustSweep';

import DustSweepPage from './DustSweepPage';
import { useDustSweep } from './DustSweepProvider';
import { useDustSweepSession } from './hooks/useDustSweepSession';
import {
  DustSweepUnknownSubmission,
  executeDustSweepItem,
} from './utils/execution';

// Exercise React Navigation's real nested StackRouter and beforeRemove events;
// only the platform's visual stack renderer is replaced for jsdom.
function TestStack(props: Parameters<typeof useNavigationBuilder>[1]) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    StackRouter,
    props,
  );
  return (
    <NavigationContent>
      {state.routes.map((route, index) => (
        <div key={route.key} hidden={index !== state.index}>
          {(
            descriptors[route.key].options as { headerLeft?: () => ReactNode }
          ).headerLeft?.()}
          {descriptors[route.key].render()}
        </div>
      ))}
    </NavigationContent>
  );
}
function createTestStack() {
  return createNavigatorFactory(TestStack)() as {
    Navigator: typeof TestStack;
    Screen: ComponentType<{
      name: string;
      component: ComponentType;
      initialParams?: Record<string, string>;
    }>;
  };
}
const ParentStack = createTestStack();
const ModalStack = createTestStack();
const mockDialog = jest.fn<
  ReturnType<typeof import('@onekeyhq/components').Dialog.show>,
  [IDialogShowProps]
>();
const mockWarning = jest.fn<void, [unknown]>();
let mockProviderMounts = 0;
let mockProviderUnmounts = 0;
let mockDesktop = true;
let mockNative = false;
let mockOverlay = true;
const mockDialogClose = jest.fn().mockResolvedValue(undefined);

function Box({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  return <div data-testid={testID}>{children}</div>;
}
function Button({
  children,
  onPress,
  testID,
}: PropsWithChildren<{ onPress?: () => void; testID?: string }>) {
  return (
    <button type="button" onClick={onPress} data-testid={testID}>
      {children}
    </button>
  );
}
jest.mock('@onekeyhq/components', () => ({
  createStackNavigator: () => createTestStack(),
  useTheme: () => ({ bgApp: { val: '#fff' }, text: { val: '#000' } }),
  useIsOverlayPage: () => mockOverlay,
  usePageType: () => 'modal',
  makeModalStackNavigatorOptions: () => ({}),
  makeTabScreenOptions: () => ({}),
  NavBackButton: ({ onPress }: { onPress: () => void }) => (
    <Button testID="nav-header-back" onPress={onPress}>
      Header back
    </Button>
  ),
  Page: Object.assign(Box, { Header: () => null, Body: Box, Footer: Box }),
  Stack: Box,
  XStack: Box,
  YStack: Box,
  ScrollView: Box,
  SizableText: Box,
  Icon: () => null,
  IconButton: Button,
  useMedia: () => ({ gtMd: mockDesktop }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
  Dialog: { show: (props: IDialogShowProps) => mockDialog(props) },
  Toast: { warning: (props: unknown) => mockWarning(props) },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockNative;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: Box },
  useReducedMotion: () => true,
  useSharedValue: () => ({ value: 0 }),
  useAnimatedStyle: () => ({}),
  cancelAnimation: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      dustSweep: {
        dustSweepStart: jest.fn(),
        dustSweepPageVisited: jest.fn(),
        dustSweepResult: jest.fn(),
        dustSweepItemResult: jest.fn(),
      },
    },
  },
}));
jest.mock('@onekeyhq/kit/src/views/Swap/hooks/useSwapTxHistory', () => ({
  generateSwapHistoryItemForContext: jest.fn(),
}));
jest.mock('./utils/execution', () => ({
  executeDustSweepItem: jest.fn(),
  DustSweepUnknownSubmission: jest.fn(),
  DustSweepUserCanceled: jest.fn(),
  DustSweepRetryableError: jest.fn(),
  DustSweepPaused: jest.fn(),
}));
jest.mock('./utils/quote', () => ({ DustSweepSkip: jest.fn() }));

const snapshot: IDustSweepSnapshot = {
  id: 'selected',
  accountId: 'account',
  address: 'address',
  networkId: 'evm--1',
  slippage: 5,
  nativeToken: {
    networkId: 'evm--1',
    contractAddress: '',
    isNative: true,
    symbol: 'ETH',
    decimals: 18,
  },
  tokens: [
    {
      key: 'a',
      networkId: 'evm--1',
      contractAddress: 'a',
      symbol: 'A',
      decimals: 6,
      amount: '1',
      valueUsd: '1',
      suspicious: false,
    },
  ],
};
type IModel = Pick<
  ReturnType<typeof useDustSweep>,
  'session' | 'selecting' | 'isFocused' | 'start' | 'sweepAgain'
>;
const ModelContext = createContext<IModel | undefined>(undefined);
function TestProvider({ children }: PropsWithChildren) {
  const session = useDustSweepSession([]);
  const isFocused = useIsFocused();
  useEffect(() => {
    mockProviderMounts += 1;
    return () => {
      mockProviderUnmounts += 1;
    };
  }, []);
  const value = useMemo<IModel>(
    () => ({
      session,
      isFocused,
      selecting: session.state.phase === 'selecting',
      start: () => session.start(snapshot),
      sweepAgain: () => session.reset(),
    }),
    [isFocused, session],
  );
  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
}
jest.mock('./DustSweepProvider', () => ({
  DustSweepProvider: TestProvider,
  DustSweepScreenProvider: ({
    value,
    children,
  }: PropsWithChildren<{ value: IModel }>) => (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  ),
  useDustSweep: () => useContext(ModelContext),
}));

function Summary({ onDone }: { onDone: () => void }) {
  const model = useDustSweep();
  const navigation = useNavigation();
  return (
    <>
      <span>{`${model.session.state.phase}:${model.isFocused ? 'focused' : 'hidden'}`}</span>
      <button
        type="button"
        onClick={() => {
          model.start();
          model.start();
        }}
      >
        Convert twice
      </button>
      <button type="button" onClick={model.sweepAgain}>
        Again
      </button>
      <button type="button" onClick={model.session.pause}>
        Stop
      </button>
      <button type="button" onClick={model.session.resume}>
        Continue
      </button>
      <button type="button" onClick={() => navigation.goBack()}>
        Local back
      </button>
      <button type="button" onClick={onDone}>
        Done
      </button>
    </>
  );
}
jest.mock('./components/DustSweepSummary', () => ({
  DustSweepSummary: Summary,
  DustSweepResult: () => null,
}));
jest.mock('./components/DustSweepSelection', () => ({
  DustSweepSelection: () => null,
}));
jest.mock('./components/DustSweepDetails', () => ({
  DustSweepDetails: () => null,
}));
jest.mock('./components/DustSweepFilters', () => ({
  DustSweepNetworks: () => null,
}));

function Home() {
  return <span>Home</span>;
}
function Modal() {
  return (
    <ModalStack.Navigator>
      <ModalStack.Screen
        name="Dust"
        component={DustSweepPage}
        initialParams={{
          walletId: 'wallet',
          accountId: 'account',
          entry: 'walletMore',
        }}
      />
    </ModalStack.Navigator>
  );
}
const ref = createNavigationContainerRef<ParamListBase>();
function mountFlow(modal = false) {
  return render(
    <BaseNavigationContainer
      ref={ref}
      initialState={{
        index: 1,
        routes: [
          { name: 'Home' },
          {
            name: modal ? 'Modal' : 'Dust',
            params: {
              walletId: 'wallet',
              accountId: 'account',
              entry: 'walletMore',
            },
          },
        ],
      }}
    >
      <ParentStack.Navigator>
        <ParentStack.Screen name="Home" component={Home} />
        <ParentStack.Screen name="Dust" component={DustSweepPage} />
        <ParentStack.Screen name="Modal" component={Modal} />
        <ParentStack.Screen name="Other" component={Home} />
      </ParentStack.Navigator>
    </BaseNavigationContainer>,
  );
}
function flowRoutes() {
  return ref.getRootState().routes.find((route) => route.name === 'Dust')?.state
    ?.routes;
}
function activeButton(name: string) {
  return screen.getByRole('button', { name });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
const execute = jest.mocked(executeDustSweepItem);
type IResult = Awaited<ReturnType<typeof executeDustSweepItem>>;
const success: IResult = {
  status: 'success',
  receivedAmount: '0.01',
  receiptUnavailable: false,
};
async function completeItem({
  onSigning,
  onBroadcast,
}: Parameters<typeof executeDustSweepItem>[0]) {
  onSigning();
  onBroadcast('tx');
  return success;
}
function confirmDialog() {
  const props = mockDialog.mock.calls.at(-1)?.[0];
  if (!props) throw new OneKeyLocalError('Expected leave confirmation');
  return props;
}
const dialogInstance = {
  close: mockDialogClose,
  preventClose: jest.fn(),
  isExist: () => true,
  getForm: () => undefined,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockProviderMounts = 0;
  mockProviderUnmounts = 0;
  mockDesktop = true;
  mockNative = false;
  mockOverlay = true;
  mockDialog.mockImplementation((props) => {
    let closed = false;
    return {
      close: async () => {
        if (closed || (props.onBeforeClose && !(await props.onBeforeClose())))
          return;
        closed = true;
        await mockDialogClose();
        await props.onClose?.();
      },
      isExist: () => !closed,
      getForm: () => undefined,
    };
  });
});

it('pushes exactly one execution route for double Convert and keeps the session mounted through Stop/Continue', async () => {
  const pending = deferred<IResult>();
  execute.mockImplementation(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('tx');
    return pending.promise;
  });
  mountFlow();
  fireEvent.click(activeButton('Convert twice'));
  expect(flowRoutes()?.map((route) => route.name)).toEqual([
    'Selection',
    'Execution',
  ]);
  expect(flowRoutes()?.[1].params).toEqual({ sessionId: expect.any(String) });
  expect(mockProviderMounts).toBe(1);
  expect(mockProviderUnmounts).toBe(0);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(screen.getByText('running:hidden')).toBeTruthy();
  expect(screen.getByText('running:focused')).toBeTruthy();
  fireEvent.click(activeButton('Stop'));
  fireEvent.click(activeButton('Continue'));
  expect(flowRoutes()).toHaveLength(2);
  expect(execute).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(success));
});

it('waits for signing before Leave, blocks dismissal meanwhile, then exits the whole flow', async () => {
  const pending = deferred<IResult>();
  execute.mockImplementation(async ({ onSigning }) => {
    onSigning();
    return pending.promise;
  });
  mountFlow();
  fireEvent.click(activeButton('Convert twice'));
  fireEvent.click(activeButton('Local back'));
  expect(mockDialog).toHaveBeenCalledTimes(1);
  const dialog = confirmDialog();
  let leaving: ReturnType<NonNullable<IDialogShowProps['onConfirm']>>;
  act(() => {
    leaving = dialog.onConfirm?.(dialogInstance);
  });
  expect(dialog.onBeforeClose?.()).toBe(false);
  expect(ref.getCurrentRoute()?.name).toBe('Execution');
  expect(mockProviderUnmounts).toBe(0);
  await act(async () => {
    pending.resolve(success);
    await leaving;
  });
  expect(dialog.onBeforeClose?.()).toBe(true);
  expect(ref.getCurrentRoute()?.name).toBe('Home');
  expect(mockProviderUnmounts).toBe(1);
});

it('keeps a newly unknown signing result in the same session until a second explicit Leave', async () => {
  const pending = deferred<IResult>();
  execute.mockImplementation(async ({ onSigning }) => {
    onSigning();
    return pending.promise;
  });
  mountFlow();
  fireEvent.click(activeButton('Convert twice'));
  fireEvent.click(activeButton('Local back'));
  const first = confirmDialog();
  let leaving: ReturnType<NonNullable<IDialogShowProps['onConfirm']>>;
  act(() => {
    leaving = first.onConfirm?.(dialogInstance);
  });
  await act(async () => {
    pending.reject(new DustSweepUnknownSubmission());
    await leaving;
  });
  expect(ref.getCurrentRoute()?.name).toBe('Execution');
  expect(mockWarning).toHaveBeenCalledTimes(1);
  act(() => {
    void first.onClose?.();
  });
  fireEvent.click(activeButton('Local back'));
  await act(async () => confirmDialog().onConfirm?.(dialogInstance));
  expect(ref.getCurrentRoute()?.name).toBe('Home');
  expect(execute).toHaveBeenCalledTimes(1);
});

it('Again returns to selection in the same provider and a new Convert creates a fresh session', async () => {
  execute.mockImplementation(completeItem);
  mountFlow();
  await act(async () => fireEvent.click(activeButton('Convert twice')));
  const firstId = flowRoutes()?.[1].params;
  fireEvent.click(activeButton('Again'));
  expect(flowRoutes()?.map((route) => route.name)).toEqual(['Selection']);
  expect(screen.getByText('selecting:focused')).toBeTruthy();
  await act(async () => fireEvent.click(activeButton('Convert twice')));
  expect(flowRoutes()?.[1].params).not.toEqual(firstId);
  expect(mockProviderMounts).toBe(1);
  expect(execute).toHaveBeenCalledTimes(2);
  fireEvent.click(activeButton('Local back'));
  expect(ref.getCurrentRoute()?.name).toBe('Home');
  expect(mockDialog).not.toHaveBeenCalled();
});

it('preserves an ancestor reset destination after confirmation instead of replacing it with Back', async () => {
  const pending = deferred<IResult>();
  execute.mockImplementation(async ({ onSigning }) => {
    onSigning();
    return pending.promise;
  });
  mountFlow();
  fireEvent.click(activeButton('Convert twice'));
  act(() =>
    ref.dispatch({
      ...CommonActions.reset({ index: 0, routes: [{ name: 'Other' }] }),
      target: ref.getRootState().key,
    }),
  );
  expect(mockDialog).toHaveBeenCalledTimes(1);
  let leaving: ReturnType<NonNullable<IDialogShowProps['onConfirm']>>;
  act(() => {
    leaving = confirmDialog().onConfirm?.(dialogInstance);
  });
  await act(async () => {
    pending.resolve(success);
    await leaving;
  });
  expect(ref.getCurrentRoute()?.name).toBe('Other');
});

it('opens completion once for the focused execution screen and does not start from hidden selection', async () => {
  mockDesktop = false;
  execute.mockImplementation(completeItem);
  mountFlow();
  await act(async () => fireEvent.click(activeButton('Convert twice')));
  expect(mockDialog).toHaveBeenCalledTimes(1);
  expect(mockDialog.mock.calls[0][0].testID).toBe('dust-sweep-result-sheet');
  const hiddenConvert = screen
    .getAllByRole('button', { name: 'Convert twice', hidden: true })
    .find((element) => element.closest('[hidden]'));
  if (!hiddenConvert)
    throw new OneKeyLocalError('Expected retained selection screen');
  fireEvent.click(hiddenConvert);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(flowRoutes()).toHaveLength(2);
});

it.each(['Done', 'Local back'])(
  'bubbles completed %s through a modal whose owning Dust route is at index zero',
  async (button) => {
    execute.mockImplementation(completeItem);
    mountFlow(true);
    await act(async () => fireEvent.click(activeButton('Convert twice')));
    expect(ref.getRootState().routes[1].state?.index).toBe(0);
    fireEvent.click(activeButton(button));
    expect(ref.getCurrentRoute()?.name).toBe('Home');
    expect(mockProviderUnmounts).toBe(1);
    expect(mockDialog).not.toHaveBeenCalled();
  },
);

it('bubbles selection Back through the first modal screen without starting execution', () => {
  mountFlow(true);
  fireEvent.click(activeButton('Local back'));
  expect(ref.getCurrentRoute()?.name).toBe('Home');
  expect(mockProviderUnmounts).toBe(1);
  expect(execute).not.toHaveBeenCalled();
  expect(mockDialog).not.toHaveBeenCalled();
});

it('bubbles confirmed local Back through the first screen of the mobile modal', async () => {
  const pending = deferred<IResult>();
  execute.mockImplementation(async ({ onSigning }) => {
    onSigning();
    return pending.promise;
  });
  mountFlow(true);
  fireEvent.click(activeButton('Convert twice'));
  fireEvent.click(activeButton('Local back'));
  expect(mockDialog).toHaveBeenCalledTimes(1);
  let leaving: ReturnType<NonNullable<IDialogShowProps['onConfirm']>>;
  act(() => {
    leaving = confirmDialog().onConfirm?.(dialogInstance);
  });
  await act(async () => {
    pending.resolve(success);
    await leaving;
  });
  expect(ref.getCurrentRoute()?.name).toBe('Home');
  expect(mockProviderUnmounts).toBe(1);
});

it('provides a visible parent Back on the initial nested page for native tab entry', () => {
  mockNative = true;
  mockOverlay = false;
  mountFlow();
  fireEvent.click(activeButton('Header back'));
  expect(ref.getCurrentRoute()?.name).toBe('Home');
  expect(execute).not.toHaveBeenCalled();
});

it('uses the native Leave layout without losing pending-transaction copy or cancel semantics', async () => {
  mockNative = true;
  const pending = deferred<IResult>();
  execute.mockImplementation(async ({ onSigning }) => {
    onSigning();
    return pending.promise;
  });
  mountFlow(true);
  fireEvent.click(activeButton('Convert twice'));
  fireEvent.click(activeButton('Local back'));
  const dialog = confirmDialog();
  expect(dialog).toMatchObject({
    nativeCentered: true,
    floatingPanelProps: { width: 350 },
    showHeader: false,
    contentContainerProps: { px: 20, pt: 20, pb: 38 },
    footerProps: { flexDirection: 'row-reverse', gap: 12 },
    cancelButtonProps: { height: 46, minHeight: 46, py: 10 },
    confirmButtonProps: { height: 46, minHeight: 46, py: 10 },
  });
  if (!isValidElement<PropsWithChildren>(dialog.renderContent))
    throw new OneKeyLocalError('Expected native confirmation content');
  const [title, description] = Children.toArray(
    dialog.renderContent.props.children,
  );
  if (
    !isValidElement<{ size: string; children: ReactNode }>(title) ||
    !isValidElement<{
      size: string;
      mt: string;
      minHeight: number;
      children: ReactNode;
    }>(description)
  )
    throw new OneKeyLocalError('Expected native title and warning');
  expect(title.props.size).toBe('$headingLg');
  expect(title.props.children).toBe(dialog.title);
  expect(description.props).toMatchObject({
    size: '$bodyMd',
    mt: '$2',
    minHeight: 60,
    children: dialog.description,
  });
  expect(dialog.description).toContain(ETranslations.swap_review_tx_pending);
  expect(dialog.onBeforeClose?.()).toBe(true);
  act(() => {
    void dialog.onClose?.();
  });
  expect(execute.mock.calls[0][0].signal.aborted).toBe(false);
  expect(ref.getCurrentRoute()?.name).toBe('Execution');
  fireEvent.click(activeButton('Local back'));
  expect(mockDialog).toHaveBeenCalledTimes(2);
  await act(async () => pending.resolve(success));
});

it('closes an obsolete Leave dialog before completion and rejects its callback after Again starts a new session', async () => {
  mockDesktop = false;
  const first = deferred<IResult>();
  const second = deferred<IResult>();
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('first');
    return first.promise;
  });
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('second');
    return second.promise;
  });
  mountFlow();
  fireEvent.click(activeButton('Convert twice'));
  fireEvent.click(activeButton('Local back'));
  const oldLeave = confirmDialog();
  await act(async () => first.resolve(success));
  expect(mockDialogClose).toHaveBeenCalledTimes(1);
  expect(mockDialog.mock.calls.at(-1)?.[0].testID).toBe(
    'dust-sweep-result-sheet',
  );
  fireEvent.click(activeButton('Again'));
  fireEvent.click(activeButton('Convert twice'));
  const sessionId = flowRoutes()?.[1].params;
  await act(async () => oldLeave.onConfirm?.(dialogInstance));
  expect(execute).toHaveBeenCalledTimes(2);
  expect(execute.mock.calls[1][0].signal.aborted).toBe(false);
  expect(flowRoutes()?.[1].params).toEqual(sessionId);
  expect(screen.getByText('running:focused')).toBeTruthy();
  await act(async () => second.resolve(success));
});
