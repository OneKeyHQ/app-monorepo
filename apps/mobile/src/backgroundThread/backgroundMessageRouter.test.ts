import {
  type IBackgroundMessageRouterHandlers,
  routeBackgroundMessage,
} from './backgroundMessageRouter';
import {
  BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX,
  BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX,
  BACKGROUND_THREAD_JOTAI_STATE_BATCH_KEY_PREFIX,
  BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX,
  BACKGROUND_THREAD_RESPONSE_KEY_PREFIX,
  WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX,
} from './rpcProtocol';
import { BACKGROUND_THREAD_READY_WAKE_KEY } from './runtimeReady';

function makeHandlers(): jest.Mocked<IBackgroundMessageRouterHandlers> {
  return {
    onReadySignal: jest.fn(),
    onResponse: jest.fn(),
    onJotaiStateBatch: jest.fn(),
    onJotaiState: jest.fn(),
    onAppEvent: jest.fn(),
    onBridgeSend: jest.fn(),
    onWebEmbedRequest: jest.fn(),
  };
}

describe('routeBackgroundMessage', () => {
  it('routes a response message to onResponse with the inline value (no read-back)', () => {
    const handlers = makeHandlers();
    const callId = `${BACKGROUND_THREAD_RESPONSE_KEY_PREFIX}42`;

    routeBackgroundMessage(handlers, callId, '{"ok":true}');

    expect(handlers.onResponse).toHaveBeenCalledWith(callId, '{"ok":true}');
    expect(handlers.onReadySignal).not.toHaveBeenCalled();
  });

  it('routes a jotai batch message to onJotaiStateBatch with the inline value', () => {
    const handlers = makeHandlers();
    const callId = `${BACKGROUND_THREAD_JOTAI_STATE_BATCH_KEY_PREFIX}7`;

    routeBackgroundMessage(handlers, callId, '{"items":[]}');

    expect(handlers.onJotaiStateBatch).toHaveBeenCalledWith(
      callId,
      '{"items":[]}',
    );
    // The batch prefix must NOT also fall through to the single-state handler.
    expect(handlers.onJotaiState).not.toHaveBeenCalled();
  });

  it('routes a single jotai message to onJotaiState with the inline value', () => {
    const handlers = makeHandlers();
    const callId = `${BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX}9`;

    routeBackgroundMessage(handlers, callId, '{"name":"atomA"}');

    expect(handlers.onJotaiState).toHaveBeenCalledWith(
      callId,
      '{"name":"atomA"}',
    );
    expect(handlers.onJotaiStateBatch).not.toHaveBeenCalled();
  });

  it('routes an app-event message to onAppEvent with the inline value', () => {
    const handlers = makeHandlers();
    const callId = `${BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX}3`;

    routeBackgroundMessage(handlers, callId, '{"eventName":"x"}');

    expect(handlers.onAppEvent).toHaveBeenCalledWith(
      callId,
      '{"eventName":"x"}',
    );
  });

  it('routes a bridge-send message to onBridgeSend with the inline value', () => {
    const handlers = makeHandlers();
    const callId = `${BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX}5`;

    routeBackgroundMessage(handlers, callId, '{"channel":"dapp"}');

    expect(handlers.onBridgeSend).toHaveBeenCalledWith(
      callId,
      '{"channel":"dapp"}',
    );
  });

  it('routes a webembed request message to onWebEmbedRequest with the inline value', () => {
    const handlers = makeHandlers();
    const callId = `${WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX}11`;

    routeBackgroundMessage(handlers, callId, '{"type":"bridge-call"}');

    expect(handlers.onWebEmbedRequest).toHaveBeenCalledWith(
      callId,
      '{"type":"bridge-call"}',
    );
  });

  it('routes the bg-ready wake ping to onReadySignal (payload is ignored)', () => {
    const handlers = makeHandlers();

    routeBackgroundMessage(handlers, BACKGROUND_THREAD_READY_WAKE_KEY, '1');

    expect(handlers.onReadySignal).toHaveBeenCalledTimes(1);
    expect(handlers.onResponse).not.toHaveBeenCalled();
  });

  it('ignores an unknown key prefix without invoking any handler', () => {
    const handlers = makeHandlers();

    routeBackgroundMessage(handlers, 'onekey:bg:unknown:1', 'whatever');

    expect(handlers.onReadySignal).not.toHaveBeenCalled();
    expect(handlers.onResponse).not.toHaveBeenCalled();
    expect(handlers.onJotaiStateBatch).not.toHaveBeenCalled();
    expect(handlers.onJotaiState).not.toHaveBeenCalled();
    expect(handlers.onAppEvent).not.toHaveBeenCalled();
    expect(handlers.onBridgeSend).not.toHaveBeenCalled();
    expect(handlers.onWebEmbedRequest).not.toHaveBeenCalled();
  });
});
