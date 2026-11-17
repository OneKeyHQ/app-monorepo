import { useMemo } from 'react';

import { useCalendars } from 'expo-localization';

import { getDeviceTimeZone } from '@onekeyhq/shared/src/utils/timeZoneUtils';

export function useDeviceTimeZone() {
  const calendars = useCalendars();
  const preferredTimeZone = calendars?.[0]?.timeZone;

  return useMemo(
    () => getDeviceTimeZone(preferredTimeZone),
    [preferredTimeZone],
  );
}
