/**
 * Local mirror of RELAYER_EVENTS / SUBSCRIBER_EVENTS from '@walletconnect/core'.
 *
 * The SDK ships a single bundled entry, so even a constants-only static import
 * pulls the whole core/utils stack (and, since utils 2.23, es-toolkit + ox)
 * into the background startup graph. The names are the SDK's wire-level event
 * identifiers; walletConnectSdkEvents.test.ts pins them to the installed SDK
 * so an upgrade cannot drift silently.
 */
export const RELAYER_EVENTS = {
  message: 'relayer_message',
  message_ack: 'relayer_message_ack',
  connect: 'relayer_connect',
  disconnect: 'relayer_disconnect',
  error: 'relayer_error',
  connection_stalled: 'relayer_connection_stalled',
  transport_closed: 'relayer_transport_closed',
  publish: 'relayer_publish',
};

export const SUBSCRIBER_EVENTS = {
  created: 'subscription_created',
  deleted: 'subscription_deleted',
  expired: 'subscription_expired',
  disabled: 'subscription_disabled',
  sync: 'subscription_sync',
  resubscribed: 'subscription_resubscribed',
};
