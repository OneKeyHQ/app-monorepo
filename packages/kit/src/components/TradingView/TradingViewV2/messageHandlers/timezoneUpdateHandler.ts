import { tradingViewTimezoneAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

import type { IMessageHandlerParams } from './types';

export async function handleTimezoneUpdate({
  data,
}: IMessageHandlerParams): Promise<void> {
  const dataWithEnvelope = data as unknown as {
    data?: unknown;
    params?: unknown;
    timezone?: unknown;
  };
  const messageData = dataWithEnvelope?.data;
  const messageParams = dataWithEnvelope?.params;
  const payload = (messageData ?? messageParams ?? dataWithEnvelope) as
    | { timezone?: unknown; params?: { timezone?: unknown } }
    | undefined;
  let timezone: unknown;
  if (payload && typeof payload === 'object') {
    const payloadRecord = payload as {
      timezone?: unknown;
      params?: { timezone?: unknown };
    };
    timezone = payloadRecord.timezone;
    if (timezone === undefined && payloadRecord.params) {
      timezone = payloadRecord.params.timezone;
    }
  }
  const timezoneValue =
    typeof timezone === 'string'
      ? timezone
      : undefined;
  const isValidTimezone =
    typeof timezoneValue === 'string' &&
    /^(Etc\/UTC|UTC|GMT[+-]\d{1,2}|[A-Za-z_]+\/[A-Za-z_]+)$/.test(timezoneValue);
  if (!isValidTimezone || !timezoneValue) {
    return;
  }

  const currentTimezone = await tradingViewTimezoneAtom.get();
  if (currentTimezone !== timezoneValue) {
    void tradingViewTimezoneAtom.set(timezoneValue);
  }
}
