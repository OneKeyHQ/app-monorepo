import { getClient, getCurrentScope, startInactiveSpan } from '@sentry/browser';

export {
  addBreadcrumb,
  captureEvent,
  captureException,
  captureMessage,
  setContext,
  setExtra,
  setExtras,
  setTag,
  setTags,
  setUser,
  withScope,
} from '@sentry/browser';

export function configureScope(callback) {
  callback(getCurrentScope());
}

export function startTransaction(context) {
  const span = startInactiveSpan(context);
  if (typeof span.finish !== 'function') {
    span.finish = () => span.end();
  }
  return span;
}

export function _callOnClient(method, ...args) {
  const client = getClient();
  const clientMethod = client?.[method];
  if (typeof clientMethod === 'function') {
    return clientMethod.apply(client, args);
  }
  return undefined;
}
