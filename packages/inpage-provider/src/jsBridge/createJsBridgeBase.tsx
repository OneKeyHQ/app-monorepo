import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import {
  ICreateJsBridgeParams,
  IJsBridge,
  IJsBridgeMessagePayload,
  JsBridgeEventPayload,
} from '../types';

function createJsBridgeBase({
  sendPayload = () => {},
  sendAsString = true,
}: ICreateJsBridgeParams = {}): IJsBridge {
  // process?.env?.VERSION will fail in RN
  const version: string = process.env.VERSION as string;
  let callbackId = 0;
  const callbacksMap: Record<string, JsBridgeEventPayload> = {
    // id: { resolve, reject }
  };
  const MESSAGE_TYPES = {
    'response': 'response',
    'request': 'request',
  };
  const eventHandlers: Record<
    string,
    Array<(data: JsBridgeEventPayload) => void>
  > = {};

  function createCallbackId() {
    callbackId += 1;
    return callbackId;
  }

  function createPayload({
    resolve,
    id,
    data,
    type,
    origin,
    remoteId,
    ...others
  }: IJsBridgeMessagePayload) {
    const payload = {
      id,
      type,
      data,
      origin,
      remoteId,
      ...others,
    };
    if (resolve && id) {
      callbacksMap[id] = { resolve };
    }
    return payload;
  }

  function createEventPayload({
    data,
    id,
    origin,
    remoteId,
    resolve,
    reject,
  }: JsBridgeEventPayload) {
    return {
      reject:
        reject ||
        ((error: Error) => {
          throw error;
        }),
      // TODO remove resolve & reject as memory problem, client reponse() manually
      resolve,
      id,
      data,
      remoteId,
      origin,
    };
  }

  return {
    version,
    MESSAGE_TYPES,
    remoteInfo: {
      origin: '',
    },
    on(eventType, handler) {
      eventHandlers[eventType] = eventHandlers[eventType] || [];
      eventHandlers[eventType].push(handler);
    },
    off() {
      throw new Error('off not implemented');
    },
    // trigger, dispatch, emit
    trigger(eventType, payload) {
      // alert(`trigger event=${eventType}`);
      const handlers = eventHandlers[eventType] || [];
      handlers.forEach((handler) => {
        if (handler) {
          handler(payload);
        }
      });
    },
    send({ type, data, id, remoteId }: IJsBridgeMessagePayload) {
      return new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        let _resolve;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        let _id = id;
        if (type === MESSAGE_TYPES.request) {
          _resolve = resolve;
          _id = _id || createCallbackId();
        }
        const payload = createPayload({
          resolve: _resolve,
          id: _id,
          data,
          type,
          // TODO value in HOST
          origin: global?.location?.origin,
          remoteId,
        });
        let payloadToSend: unknown = payload;
        if (sendAsString) {
          payloadToSend = JSON.stringify(payload);
        }
        // TODO rename sendMessage
        if (sendPayload) {
          sendPayload(payloadToSend as string);
        }
      });
    },
    receive(payloadStr = '') {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      let payload: IJsBridgeMessagePayload = {};
      if (isPlainObject(payloadStr)) {
        payload = payloadStr as IJsBridgeMessagePayload;
      }
      if (isString(payloadStr)) {
        payload = JSON.parse(payloadStr) as IJsBridgeMessagePayload;
      }

      const { type, id, data, origin, remoteId } = payload;
      this.remoteInfo = {
        origin,
        remoteId,
      };
      // TODO origin validation check

      if (type === MESSAGE_TYPES.response) {
        const callbackInfo = callbacksMap[id as string];
        if (callbackInfo && callbackInfo.resolve) {
          // TODO remove cache after resolve
          callbackInfo.resolve(data);
        }
      } else {
        const eventPayload = createEventPayload({
          resolve: (d) => {
            self.response(id as string, d, null, remoteId);
          },
          id,
          data,
          origin,
          remoteId,
        });
        // TODO onReceive/responseMessage -> auto response resolve, catch error reject
        this.trigger('message', eventPayload);
      }
    },
    // TODO requestToAll
    // send request to remote
    request(data: unknown, remoteId = null) {
      return this.send({
        type: this.MESSAGE_TYPES.request,
        data,
        remoteId,
      });
    },
    // send response to remote
    response(id, data: unknown, error = null, remoteId = null) {
      if (error) {
        console.error(error);
      }
      // TODO error reject
      return this.send({
        type: this.MESSAGE_TYPES.response,
        data,
        id,
        remoteId,
      });
    },
    // response middleware
    // send response from request message
    responseMessage(requestMsg: string) {
      // TODO
      console.log(requestMsg);
    },
  };
}

export default createJsBridgeBase;
