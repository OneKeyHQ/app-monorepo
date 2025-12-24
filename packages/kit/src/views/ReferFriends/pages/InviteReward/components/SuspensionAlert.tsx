import { useCallback, useMemo } from 'react';

import { Alert, YStack } from '@onekeyhq/components';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';

type ISuspensionAlertProps = {
  suspensionNotice?: string;
  suspensionContactLabel?: string;
};

function SuspensionAlert({
  suspensionNotice,
  suspensionContactLabel,
}: ISuspensionAlertProps) {
  const handleContactSupport = useCallback(() => {
    void showIntercom();
  }, []);

  const alertAction = useMemo(() => {
    if (!suspensionContactLabel) {
      return undefined;
    }
    return {
      primary: suspensionContactLabel,
      onPrimaryPress: handleContactSupport,
    };
  }, [suspensionContactLabel, handleContactSupport]);

  if (!suspensionNotice) {
    return null;
  }

  return (
    <YStack px="$5" pt="$5">
      <Alert type="critical" title={suspensionNotice} action={alertAction} />
    </YStack>
  );
}

export { SuspensionAlert };
