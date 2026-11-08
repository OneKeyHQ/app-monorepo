import {
  ENotificationPushMessageMode,
  type INotificationPushMessageInfo,
} from '../../types/notification';
import appGlobals from '../appGlobals';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { ETranslations } from '../locale';
import platformEnv from '../platformEnv';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  EWebViewRoutes,
} from '../routes';
import { EModalNotificationsRoutes } from '../routes/notifications';

import extUtils from './extUtils';
import notificationsUtils, {
  type INotificationPageNavigationEvent,
  navigateToNotificationDetailByLocalParams,
  parseNotificationPayload,
  registerNotificationPageNavigationProcessor,
  takePendingLegacyNavigationEvent,
} from './notificationsUtils';
import timerUtils from './timerUtils';

const mockLog = jest.fn<void, unknown[]>();

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: {
      error: { log: (...args: unknown[]) => mockLog(...args) },
      page: { notificationItemClicked: jest.fn() },
    },
  },
}));

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((state: unknown) => ({ type: 'RESET', payload: state })),
  },
  StackActions: {
    push: jest.fn((screen: string, params: unknown) => ({
      type: 'PUSH',
      payload: { screen, params },
    })),
  },
}));

jest.mock('../eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    ShowNotificationInDappPage: 'show-dapp',
    SwitchDiscoveryTabInNative: 'SwitchDiscoveryTabInNative',
    ShowNotificationPageNavigation: 'ShowNotificationPageNavigation',
    UpdateNotificationBadge: 'UpdateNotificationBadge',
  },
  appEventBus: {
    emit: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('./openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('./extUtils', () => ({
  __esModule: true,
  default: { openExpandTabOrSidePanel: jest.fn(async () => undefined) },
}));

jest.mock('./timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn(async () => undefined),
  },
}));

const mockAppEventBus = appEventBus as typeof appEventBus & {
  emit: jest.Mock;
  on: jest.Mock;
};

const foregroundPageListener = mockAppEventBus.on.mock.calls.find(
  ([name]) => name === EAppEventBusNames.ShowNotificationPageNavigation,
)?.[1] as ((event: unknown) => void) | undefined;

async function createNativeNavigationRuntime(isBackground: boolean) {
  let runtime!: {
    utils: typeof import('./notificationsUtils');
    globals: typeof appGlobals;
    bus: typeof mockAppEventBus;
    listener?: (event: INotificationPageNavigationEvent) => void;
  };
  // Each registry owns its platform flags, globals, pending slot and listener,
  // matching native main/bg heaps rather than switching one shared singleton.
  await jest.isolateModulesAsync(async () => {
    const { default: runtimePlatform } = await import('../platformEnv');
    runtimePlatform.isNative = true;
    runtimePlatform.isNativeBackgroundThread = isBackground;
    runtimePlatform.isExtensionBackground = false;
    const { default: globals } = await import('../appGlobals');
    globals.$navigationRef = undefined as never;
    globals.$backgroundApiProxy = {
      serviceNotification: {
        ackNotificationMessage: jest.fn(async () => undefined),
      },
    } as never;
    const { appEventBus: bus } = await import('../eventBus/appEventBus');
    const utils = await import('./notificationsUtils');
    const runtimeBus = bus as typeof mockAppEventBus;
    const listener = isBackground
      ? undefined
      : (runtimeBus.on.mock.calls
          .filter(
            ([name]) =>
              name === EAppEventBusNames.ShowNotificationPageNavigation,
          )
          .at(-1)?.[1] as
          | ((event: INotificationPageNavigationEvent) => void)
          | undefined);
    runtime = { utils, globals, bus: runtimeBus, listener };
  });
  return runtime;
}

type INativeNavigationRuntime = Awaited<
  ReturnType<typeof createNativeNavigationRuntime>
>;

function relayNativeNavigationWake(
  background: INativeNavigationRuntime,
  main: INativeNavigationRuntime,
) {
  const event = background.bus.emit.mock.calls
    .filter(
      ([name]) => name === EAppEventBusNames.ShowNotificationPageNavigation,
    )
    .at(-1)?.[1] as INotificationPageNavigationEvent;
  const { listener } = main;
  expect(listener).toBeDefined();
  listener?.(
    JSON.parse(JSON.stringify(event)) as INotificationPageNavigationEvent,
  );
}

async function emitNativeNavigationClick(
  background: INativeNavigationRuntime,
  kind: 'legacy' | 'modern',
) {
  if (kind === 'legacy') {
    await background.utils.default.navigateToNotificationDetail({
      notificationId: 'legacy',
      isFromNotificationClick: true,
      isRead: true,
      message: undefined,
    });
  } else {
    expect(
      background.utils.parseNotificationPayload(
        ENotificationPushMessageMode.page,
        JSON.stringify({
          screen: ERootRoutes.WebView,
          params: {
            screen: EWebViewRoutes.WebView,
            params: { url: 'https://onekey.so' },
          },
        }),
        jest.fn(),
      ),
    ).toBe(true);
  }
}

function connectNativeNavigationConsumer(
  background: INativeNavigationRuntime,
  main: INativeNavigationRuntime,
) {
  const consume = jest.fn(async () => {
    const event = background.utils.takePendingLegacyNavigationEvent();
    return event
      ? (JSON.parse(JSON.stringify(event)) as INotificationPageNavigationEvent)
      : undefined;
  });
  main.globals.$backgroundApiProxy = {
    serviceNotification: { consumePendingLegacyNavigation: consume },
  } as never;
  return () =>
    main.globals.$backgroundApiProxy.serviceNotification.consumePendingLegacyNavigation();
}

describe('native notification navigation across isolated main/bg runtimes', () => {
  const flushDrain = async () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

  it.each([
    ['legacy', 'modern', false],
    ['legacy', 'modern', true],
    ['modern', 'legacy', false],
    ['modern', 'legacy', true],
  ] as const)(
    'processes only the latest %s → %s before registration (lost wakes: %s)',
    async (first, second, loseWakes) => {
      const background = await createNativeNavigationRuntime(true);
      const main = await createNativeNavigationRuntime(false);
      expect(main.utils).not.toBe(background.utils);
      expect(main.globals).not.toBe(background.globals);
      const consume = connectNativeNavigationConsumer(background, main);
      const process = jest.fn<void, [INotificationPageNavigationEvent]>();
      for (const kind of [first, second]) {
        await emitNativeNavigationClick(background, kind);
        if (!loseWakes) relayNativeNavigationWake(background, main);
      }
      expect(process).not.toHaveBeenCalled();
      expect(main.utils.takePendingLegacyNavigationEvent()).toBeUndefined();
      const unregister = main.utils.registerNotificationPageNavigationProcessor(
        process,
        consume,
      );
      try {
        await flushDrain();
        expect(process).toHaveBeenCalledTimes(1);
        expect(process.mock.calls[0][0].payload.screen).toBe(
          second === 'modern' ? ERootRoutes.WebView : ERootRoutes.Modal,
        );
      } finally {
        unregister();
      }
    },
  );

  it('recovers a modern-only intent when its initial wake was lost', async () => {
    const background = await createNativeNavigationRuntime(true);
    await emitNativeNavigationClick(background, 'modern');
    const main = await createNativeNavigationRuntime(false);
    const process = jest.fn<void, [INotificationPageNavigationEvent]>();
    const unregister = main.utils.registerNotificationPageNavigationProcessor(
      process,
      connectNativeNavigationConsumer(background, main),
    );
    try {
      await flushDrain();
      expect(process).toHaveBeenCalledTimes(1);
      expect(process.mock.calls[0][0].payload.screen).toBe(ERootRoutes.WebView);
    } finally {
      unregister();
    }
  });

  it.each([
    ['legacy', 'modern'],
    ['modern', 'legacy'],
  ] as const)(
    'serializes %s → %s during async processing and deduplicates concurrent wakes',
    async (first, second) => {
      const background = await createNativeNavigationRuntime(true);
      const main = await createNativeNavigationRuntime(false);
      await emitNativeNavigationClick(background, first);
      let finishFirst!: () => void;
      const firstDone = new Promise<void>((resolve) => {
        finishFirst = resolve;
      });
      const process = jest.fn<
        Promise<void>,
        [INotificationPageNavigationEvent]
      >(async () => {
        if (process.mock.calls.length === 1) await firstDone;
      });
      const unregister = main.utils.registerNotificationPageNavigationProcessor(
        process,
        connectNativeNavigationConsumer(background, main),
      );
      try {
        await flushDrain();
        expect(process).toHaveBeenCalledTimes(1);
        await emitNativeNavigationClick(background, second);
        relayNativeNavigationWake(background, main);
        relayNativeNavigationWake(background, main);
        await flushDrain();
        expect(process).toHaveBeenCalledTimes(1);
        finishFirst();
        await flushDrain();
        expect(
          process.mock.calls.map(([event]) => event.payload.screen),
        ).toEqual(
          [first, second].map((kind) =>
            kind === 'modern' ? ERootRoutes.WebView : ERootRoutes.Modal,
          ),
        );
      } finally {
        finishFirst();
        unregister();
      }
    },
  );

  it('retains a second wake while the first consume RPC is awaiting its response', async () => {
    const background = await createNativeNavigationRuntime(true);
    const main = await createNativeNavigationRuntime(false);
    await emitNativeNavigationClick(background, 'legacy');
    const consume = connectNativeNavigationConsumer(background, main);
    let releaseResponse!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const delayedConsume = jest.fn<
      Promise<INotificationPageNavigationEvent | undefined>,
      []
    >(async () => {
      const event = await consume();
      if (delayedConsume.mock.calls.length === 1) await responseReady;
      return event;
    });
    const process = jest.fn<void, [INotificationPageNavigationEvent]>();
    const unregister = main.utils.registerNotificationPageNavigationProcessor(
      process,
      delayedConsume,
    );
    try {
      await flushDrain();
      expect(process).not.toHaveBeenCalled();
      await emitNativeNavigationClick(background, 'modern');
      relayNativeNavigationWake(background, main);
      releaseResponse();
      await flushDrain();
      expect(process.mock.calls.map(([event]) => event.payload.screen)).toEqual(
        [ERootRoutes.Modal, ERootRoutes.WebView],
      );
      expect(delayedConsume).toHaveBeenCalledTimes(2);
    } finally {
      releaseResponse();
      unregister();
    }
  });
});

describe('legacy notification clicks from native background', () => {
  const originalNavigationRef = appGlobals.$navigationRef;
  const originalBackgroundApiProxy = appGlobals.$backgroundApiProxy;
  const originalIsNative = platformEnv.isNative;
  const originalIsNativeBackgroundThread = platformEnv.isNativeBackgroundThread;
  const originalIsExtensionBackground = platformEnv.isExtensionBackground;
  const originalIsDesktop = platformEnv.isDesktop;
  const originalIsWeb = platformEnv.isWeb;

  beforeEach(() => {
    jest.clearAllMocks();
    appGlobals.$navigationRef = undefined as never;
    appGlobals.$backgroundApiProxy = {
      serviceNotification: {
        ackNotificationMessage: jest.fn().mockResolvedValue(undefined),
      },
    } as never;
    platformEnv.isNative = true;
    platformEnv.isNativeBackgroundThread = true;
    platformEnv.isExtensionBackground = false;
  });

  afterEach(() => {
    appGlobals.$navigationRef = originalNavigationRef;
    appGlobals.$backgroundApiProxy = originalBackgroundApiProxy;
    platformEnv.isNative = originalIsNative;
    platformEnv.isNativeBackgroundThread = originalIsNativeBackgroundThread;
    platformEnv.isExtensionBackground = originalIsExtensionBackground;
    platformEnv.isDesktop = originalIsDesktop;
    platformEnv.isWeb = originalIsWeb;
  });

  it('keeps foreground legacy clicks on the explicit pushModal path', async () => {
    const pushModal = jest.fn();
    const dispatch = jest.fn();
    platformEnv.isNativeBackgroundThread = false;
    appGlobals.$navigationRef = {
      current: { getState: jest.fn(() => ({ routes: [] })), dispatch },
    } as never;

    await notificationsUtils.navigateToNotificationDetail({
      notificationId: 'test-notification',
      isFromNotificationClick: true,
      message: undefined,
      mode: undefined,
      navigation: { pushModal } as never,
    });

    expect(pushModal).toHaveBeenCalledWith(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
      params: {},
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(mockAppEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.ShowNotificationPageNavigation,
      expect.anything(),
    );
  });

  it.each(['desktop', 'web'] as const)(
    'keeps %s legacy clicks on the direct push path',
    async (target) => {
      const dispatch = jest.fn();
      platformEnv.isNative = false;
      platformEnv.isNativeBackgroundThread = false;
      platformEnv.isDesktop = target === 'desktop';
      platformEnv.isWeb = target === 'web';
      appGlobals.$navigationRef = {
        current: { getState: jest.fn(() => ({ routes: [] })), dispatch },
      } as never;

      await notificationsUtils.navigateToNotificationDetail({
        notificationId: 'test-notification',
        isFromNotificationClick: true,
        message: undefined,
        mode: undefined,
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'PUSH',
        payload: {
          screen: ERootRoutes.Modal,
          params: {
            screen: EModalRoutes.NotificationsModal,
            params: {
              screen: EModalNotificationsRoutes.NotificationList,
              params: {},
            },
          },
        },
      });
      expect(mockAppEventBus.emit).not.toHaveBeenCalledWith(
        EAppEventBusNames.ShowNotificationPageNavigation,
        expect.anything(),
      );
    },
  );

  it('keeps extension-background legacy clicks on the expand path', async () => {
    platformEnv.isNative = false;
    platformEnv.isNativeBackgroundThread = false;
    platformEnv.isExtensionBackground = true;

    await notificationsUtils.navigateToNotificationDetail({
      notificationId: 'test-notification',
      isFromNotificationClick: true,
      message: undefined,
      mode: undefined,
    });

    expect(extUtils.openExpandTabOrSidePanel).toHaveBeenCalledWith({
      routes: [
        ERootRoutes.Modal,
        EModalRoutes.NotificationsModal,
        EModalNotificationsRoutes.NotificationList,
      ],
      params: {},
    });
    expect(mockAppEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.ShowNotificationPageNavigation,
      expect.anything(),
    );
  });

  it.each([
    [
      'notification list',
      undefined,
      EModalRoutes.NotificationsModal,
      EModalNotificationsRoutes.NotificationList,
    ],
    [
      'transaction detail',
      {
        extras: {
          params: {
            accountId: 'test-account',
            networkId: 'test-network',
            accountAddress: 'test-address',
            transactionHash: 'test-transaction',
          },
        },
      } as INotificationPushMessageInfo,
      EModalRoutes.MainModal,
      EModalAssetDetailRoutes.HistoryDetails,
    ],
  ])(
    'relays the %s legacy intent through a late foreground processor',
    async (_label, message, expectedModal, expectedLeaf) => {
      await notificationsUtils.navigateToNotificationDetail({
        notificationId: 'test-notification',
        isFromNotificationClick: true,
        message,
        mode: undefined,
      });
      const emittedEvent = mockAppEventBus.emit.mock.calls.find(
        ([name]) => name === EAppEventBusNames.ShowNotificationPageNavigation,
      )?.[1] as INotificationPageNavigationEvent;
      const relayedEvent = JSON.parse(
        JSON.stringify(emittedEvent),
      ) as INotificationPageNavigationEvent;
      expect(foregroundPageListener).toBeDefined();
      // A wake can be lost before main installs the native observer. Pull the
      // BG-owned intent through the consumer after registration instead.

      const dispatch = jest.fn();
      const getEarnAccount = jest.fn(async () => null);
      appGlobals.$navigationRef = {
        current: { dispatch, getState: jest.fn(() => ({ routes: [] })) },
      } as never;
      platformEnv.isNativeBackgroundThread = false;
      let processing: Promise<void> | undefined;
      const unregister = registerNotificationPageNavigationProcessor(
        ({ payload, navigationAction }) => {
          processing = navigateToNotificationDetailByLocalParams({
            payload,
            navigationAction,
            localParams: { accountId: 'other-account' },
            getEarnAccount,
          });
        },
        async () => {
          const pending = takePendingLegacyNavigationEvent();
          return pending
            ? (JSON.parse(
                JSON.stringify(pending),
              ) as INotificationPageNavigationEvent)
            : undefined;
        },
      );
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(processing).toBeDefined();
        await processing;
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith({
          type: 'PUSH',
          payload: relayedEvent.payload,
        });
        expect(relayedEvent.navigationAction).toBe('push');
        expect(relayedEvent.payload.screen).toBe(ERootRoutes.Modal);
        expect(relayedEvent.payload.params.screen).toBe(expectedModal);
        expect(relayedEvent.payload.params.params.screen).toBe(expectedLeaf);
        if (message) {
          expect(relayedEvent.payload.params.params.params).toEqual({
            accountId: 'test-account',
            networkId: 'test-network',
            accountAddress: 'test-address',
            transactionHash: 'test-transaction',
            notificationId: 'test-notification',
            notificationAccountId: undefined,
            checkIsFocused: false,
            allowClickAccountNameSwitch: true,
          });
        } else {
          expect(relayedEvent.payload.params.params.params).toEqual({});
        }
        expect(getEarnAccount).not.toHaveBeenCalled();
      } finally {
        unregister();
      }
    },
  );
});

describe('foreground notification page intent', () => {
  const originalNavigationRef = appGlobals.$navigationRef;
  const flushDrain = async () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

  afterEach(() => {
    appGlobals.$navigationRef = originalNavigationRef;
  });

  it('pulls a legacy intent after registration even when its wake was lost before the foreground listener existed', async () => {
    const event: INotificationPageNavigationEvent = {
      payload: {
        screen: ERootRoutes.Modal,
        params: { screen: EModalRoutes.NotificationsModal },
      },
      navigationAction: 'push',
    };
    const process = jest.fn(async () => undefined);
    const consume = jest
      .fn<Promise<INotificationPageNavigationEvent | undefined>, []>()
      .mockResolvedValueOnce(event)
      .mockResolvedValue(undefined);

    // No foreground AppEventBus callback fires: the native write occurred
    // before main registered its SharedRPC observer.
    const unregister = registerNotificationPageNavigationProcessor(
      process,
      consume,
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(process).toHaveBeenCalledTimes(1);
      expect(process).toHaveBeenCalledWith(event);
    } finally {
      unregister();
    }
  });

  it('pulls once for initial registration and repeated wakes of the same BG intent', async () => {
    const event: INotificationPageNavigationEvent = {
      payload: {
        screen: ERootRoutes.Modal,
        params: { screen: EModalRoutes.NotificationsModal },
      },
      navigationAction: 'push',
    };
    const process = jest.fn(async () => undefined);
    const consume = jest
      .fn<Promise<INotificationPageNavigationEvent | undefined>, []>()
      .mockResolvedValueOnce(event)
      .mockResolvedValue(undefined);
    const unregister = registerNotificationPageNavigationProcessor(
      process,
      consume,
    );
    try {
      foregroundPageListener?.(event);
      foregroundPageListener?.(event);
      await flushDrain();
      expect(process).toHaveBeenCalledTimes(1);
      expect(process).toHaveBeenCalledWith(event);
    } finally {
      unregister();
    }
  });

  it('keeps navigation processing serial when a second intent arrives during an async processor', async () => {
    const first: INotificationPageNavigationEvent = {
      payload: { screen: ERootRoutes.Modal, params: { screen: 'first' } },
      navigationAction: 'push',
    };
    const second: INotificationPageNavigationEvent = {
      payload: { screen: ERootRoutes.Modal, params: { screen: 'second' } },
      navigationAction: 'push',
    };
    let finishFirst: (() => void) | undefined;
    const firstDone = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const process = jest.fn(async (event: INotificationPageNavigationEvent) => {
      if (event === first) await firstDone;
    });
    const consume = jest
      .fn<Promise<INotificationPageNavigationEvent | undefined>, []>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockResolvedValue(undefined);
    const unregister = registerNotificationPageNavigationProcessor(
      process,
      consume,
    );
    try {
      await flushDrain();
      expect(process).toHaveBeenCalledTimes(1);
      foregroundPageListener?.(second);
      await flushDrain();
      expect(process).toHaveBeenCalledTimes(1);
      finishFirst?.();
      await flushDrain();
      expect(process.mock.calls.map(([event]) => event)).toEqual([
        first,
        second,
      ]);
    } finally {
      finishFirst?.();
      unregister();
    }
  });

  it('hands an in-flight consumed intent to the next registered processor', async () => {
    const event: INotificationPageNavigationEvent = {
      payload: {
        screen: ERootRoutes.Modal,
        params: { screen: EModalRoutes.NotificationsModal },
      },
      navigationAction: 'push',
    };
    let finishConsume:
      | ((value: INotificationPageNavigationEvent) => void)
      | undefined;
    const consumed = new Promise<INotificationPageNavigationEvent>(
      (resolve) => {
        finishConsume = resolve;
      },
    );
    const oldProcess = jest.fn();
    const newProcess = jest.fn();
    const unregisterOld = registerNotificationPageNavigationProcessor(
      oldProcess,
      () => consumed,
    );
    await flushDrain();
    unregisterOld();
    finishConsume?.(event);
    await flushDrain();
    expect(oldProcess).not.toHaveBeenCalled();
    const unregisterNew = registerNotificationPageNavigationProcessor(
      newProcess,
      async () => undefined,
    );
    try {
      await flushDrain();
      expect(newProcess).toHaveBeenCalledTimes(1);
      expect(newProcess).toHaveBeenCalledWith(event);
    } finally {
      unregisterNew();
    }
  });

  it('stops after a consumer error and retries only on a later registration', async () => {
    const event: INotificationPageNavigationEvent = {
      payload: {
        screen: ERootRoutes.Modal,
        params: { screen: EModalRoutes.NotificationsModal },
      },
      navigationAction: 'push',
    };
    const consume = jest
      .fn<Promise<INotificationPageNavigationEvent | undefined>, []>()
      .mockRejectedValueOnce(new Error('temporary RPC failure'))
      .mockResolvedValueOnce(event)
      .mockResolvedValue(undefined);
    const process = jest.fn();
    const unregister = registerNotificationPageNavigationProcessor(
      process,
      consume,
    );
    await flushDrain();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(process).not.toHaveBeenCalled();
    unregister();
    const unregisterRetry = registerNotificationPageNavigationProcessor(
      process,
      consume,
    );
    try {
      await flushDrain();
      expect(process).toHaveBeenCalledTimes(1);
      expect(process).toHaveBeenCalledWith(event);
    } finally {
      unregisterRetry();
    }
  });

  it('updates the badge instead of pushing an already active notification list', async () => {
    jest.clearAllMocks();
    const dispatch = jest.fn();
    appGlobals.$navigationRef = {
      current: {
        dispatch,
        getState: jest.fn(() => ({
          index: 0,
          routes: [
            {
              name: ERootRoutes.Modal,
              params: { screen: EModalRoutes.MainModal },
              state: {
                index: 0,
                routes: [{ name: EModalRoutes.NotificationsModal }],
              },
            },
            { name: ERootRoutes.Main },
          ],
        })),
      },
    } as never;
    const getEarnAccount = jest.fn(async () => null);

    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Modal,
        params: {
          screen: EModalRoutes.NotificationsModal,
          params: { screen: EModalNotificationsRoutes.NotificationList },
        },
      },
      navigationAction: 'push',
      localParams: {},
      getEarnAccount,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(mockAppEventBus.emit).toHaveBeenCalledTimes(1);
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.UpdateNotificationBadge,
      undefined,
    );
    expect(getEarnAccount).not.toHaveBeenCalled();
  });

  it('still pushes a notification list when another modal is active', async () => {
    const dispatch = jest.fn();
    appGlobals.$navigationRef = {
      current: {
        dispatch,
        getState: jest.fn(() => ({
          index: 0,
          routes: [
            {
              name: ERootRoutes.Modal,
              params: { screen: EModalRoutes.MainModal },
            },
          ],
        })),
      },
    } as never;
    const params = {
      screen: EModalRoutes.NotificationsModal,
      params: { screen: EModalNotificationsRoutes.NotificationList },
    };
    await navigateToNotificationDetailByLocalParams({
      payload: { screen: ERootRoutes.Modal, params },
      navigationAction: 'push',
      localParams: {},
      getEarnAccount: jest.fn(async () => null),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PUSH',
      payload: { screen: ERootRoutes.Modal, params },
    });
  });

  it('pushes HistoryDetails even while NotificationsModal is active and resolves a local template', async () => {
    const dispatch = jest.fn();
    appGlobals.$navigationRef = {
      current: {
        dispatch,
        getState: jest.fn(() => ({
          index: 0,
          routes: [
            {
              name: ERootRoutes.Modal,
              params: { screen: EModalRoutes.NotificationsModal },
            },
          ],
        })),
      },
    } as never;
    const getEarnAccount = jest.fn(async () => null);
    const params = {
      screen: EModalRoutes.MainModal,
      params: {
        screen: EModalAssetDetailRoutes.HistoryDetails,
        params: {
          accountId: '{local_accountId}',
          networkId: 'test-network',
          transactionHash: 'test-transaction',
        },
      },
    };

    await navigateToNotificationDetailByLocalParams({
      payload: { screen: ERootRoutes.Modal, params },
      navigationAction: 'push',
      localParams: { accountId: 'selected-account' },
      getEarnAccount,
    });
    expect(getEarnAccount).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PUSH',
      payload: {
        screen: ERootRoutes.Modal,
        params: {
          screen: EModalRoutes.MainModal,
          params: {
            screen: EModalAssetDetailRoutes.HistoryDetails,
            params: {
              accountId: 'selected-account',
              networkId: 'test-network',
              transactionHash: 'test-transaction',
            },
          },
        },
      },
    });
  });

  it.each(['push', undefined] as const)(
    'resolves the network template before account lookup (action: %s)',
    async (navigationAction) => {
      const dispatch = jest.fn();
      const navigate = jest.fn();
      appGlobals.$navigationRef = {
        current: { dispatch, navigate, getRootState: jest.fn() },
      } as never;
      const getEarnAccount = jest.fn(
        async ({ networkId }: { networkId: string }) => {
          expect(networkId).toBe('selected-network');
          return {
            walletId: 'selected-wallet',
            accountId: 'resolved-account',
            networkId,
            accountAddress: 'resolved-address',
            account: { indexedAccountId: 'resolved-indexed-account' },
          } as never;
        },
      );
      const params = {
        screen: EModalRoutes.MainModal,
        params: {
          screen: EModalAssetDetailRoutes.HistoryDetails,
          params: {
            accountId: '{local_accountId}',
            indexedAccountId: '{local_indexedAccountId}',
            networkId: '{local_networkId}',
            transactionHash: 'test-transaction',
          },
        },
      };

      await navigateToNotificationDetailByLocalParams({
        payload: { screen: ERootRoutes.Modal, params },
        navigationAction,
        localParams: {
          accountId: 'selected-account',
          networkId: 'selected-network',
        },
        getEarnAccount,
      });

      expect(getEarnAccount).toHaveBeenCalledWith({
        accountId: 'selected-account',
        indexedAccountId: '',
        networkId: 'selected-network',
      });
      expect(params.params.params).toEqual({
        accountId: 'resolved-account',
        indexedAccountId: 'resolved-indexed-account',
        networkId: 'selected-network',
        transactionHash: 'test-transaction',
      });
      expect(
        navigationAction === 'push' ? dispatch : navigate,
      ).toHaveBeenCalledTimes(1);
    },
  );

  it('skips lookup for an unresolved network template and removes the placeholder', async () => {
    const dispatch = jest.fn();
    appGlobals.$navigationRef = { current: { dispatch } } as never;
    const getEarnAccount = jest.fn(async () => null);
    const params = {
      networkId: '{local_networkId}',
      accountId: '{local_accountId}',
    };

    await navigateToNotificationDetailByLocalParams({
      payload: { screen: ERootRoutes.Modal, params },
      navigationAction: 'push',
      localParams: { accountId: 'selected-account' },
      getEarnAccount,
    });

    expect(getEarnAccount).not.toHaveBeenCalled();
    expect(params).toEqual({ accountId: 'selected-account' });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('does not let a push marker bypass non-modal WebView URL validation', async () => {
    const dispatch = jest.fn();
    appGlobals.$navigationRef = { current: { dispatch } } as never;

    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.WebView,
        params: {
          screen: EWebViewRoutes.WebView,
          params: { url: 'http://localhost/private' },
        },
      },
      navigationAction: 'push',
      localParams: {},
      getEarnAccount: jest.fn(async () => null),
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not promote internal navigation markers from modern server payload or extras', () => {
    jest.clearAllMocks();
    const payload = {
      screen: ERootRoutes.Main,
      params: { screen: ETabRoutes.Discovery },
      navigationAction: 'push',
      isNativeBackgroundNavigation: true,
    };
    const extras = {
      navigationAction: 'push',
      isNativeBackgroundNavigation: true,
    };

    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.page,
        JSON.stringify(payload),
        jest.fn(),
        extras,
      ),
    ).toBe(true);
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.ShowNotificationPageNavigation,
      { payload, extras },
    );
  });
});

describe('navigateToNotificationDetailByLocalParams (Native Market & Discovery routing)', () => {
  const navigateMock = jest.fn();
  const getRootStateMock = jest.fn(() => ({
    routes: [{ name: ERootRoutes.Main }],
    index: 0,
  }));
  const getEarnAccountMock = jest.fn(async () => null);
  const originalNavigationRef = appGlobals.$navigationRef;
  const originalTabletMainViewNavigationRef =
    appGlobals.$tabletMainViewNavigationRef;
  const originalIsNative = platformEnv.isNative;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    platformEnv.isNative = true;
    (timerUtils.wait as jest.Mock).mockResolvedValue(undefined);
    appGlobals.$tabletMainViewNavigationRef = undefined as never;
    appGlobals.$navigationRef = {
      current: {
        navigate: navigateMock,
        getRootState: getRootStateMock,
        dispatch: jest.fn(),
      },
    } as never;
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isNative = originalIsNative;
    appGlobals.$navigationRef = originalNavigationRef;
    appGlobals.$tabletMainViewNavigationRef =
      originalTabletMainViewNavigationRef;
  });

  it('keeps ETabRoutes.Market payloads on the standalone Market tab on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Market,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: { marketTokenId: 'bitcoin' },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: { marketTokenId: 'bitcoin' },
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it('redirects legacy Discovery-embedded Market detail notification payloads to ETabRoutes.Market on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Discovery,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: { marketTokenId: 'ethereum' },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: { marketTokenId: 'ethereum' },
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it('redirects legacy Discovery defaultTab=global_market notification payloads to ETabRoutes.Market -> TabMarket on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Discovery,
          params: {
            screen: ETabDiscoveryRoutes.TabDiscovery,
            params: { defaultTab: ETranslations.global_market },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.TabMarket,
          pop: true,
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it('still redirects ETabRoutes.Earn to ETabRoutes.Discovery and emits SwitchDiscoveryTabInNative(global_earn)', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Earn,
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Discovery,
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.SwitchDiscoveryTabInNative,
      { tab: ETranslations.global_earn },
    );
  });
});

describe('notification DApp URL rejection', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    'http://example.com/private-path?token=private-value',
    'https://localhost/private-path?token=private-value',
    'https://user:private-value@example.com/private-path',
  ])('rejects %s without including the payload in diagnostics', (url) => {
    const fallback = jest.fn();
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.openInDapp,
        url,
        fallback,
      ),
    ).toBe(false);
    expect(mockLog).toHaveBeenCalledWith(
      'parseNotificationPayload: blocked unsafe url in openInDapp',
    );
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  test('continues opening an allowed DApp URL', () => {
    const url = 'https://example.com/dapp';
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.openInDapp,
        url,
        jest.fn(),
      ),
    ).toBe(true);
    expect(mockAppEventBus.emit).toHaveBeenCalledWith('show-dapp', url);
    expect(mockLog).not.toHaveBeenCalled();
  });
});
