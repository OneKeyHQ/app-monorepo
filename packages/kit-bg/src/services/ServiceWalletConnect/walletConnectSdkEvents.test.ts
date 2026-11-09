import {
  RELAYER_EVENTS as SDK_RELAYER_EVENTS,
  SUBSCRIBER_EVENTS as SDK_SUBSCRIBER_EVENTS,
} from '@walletconnect/core';

import { RELAYER_EVENTS, SUBSCRIBER_EVENTS } from './walletConnectSdkEvents';

describe('walletConnectSdkEvents', () => {
  it('mirrors the installed SDK relayer event names', () => {
    expect(RELAYER_EVENTS).toEqual(SDK_RELAYER_EVENTS);
  });

  it('mirrors the installed SDK subscriber event names', () => {
    expect(SUBSCRIBER_EVENTS).toEqual(SDK_SUBSCRIBER_EVENTS);
  });
});
