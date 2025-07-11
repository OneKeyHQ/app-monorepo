import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

import { DesktopBleRepairDialog } from '../../../components/DesktopBleRepair';
import {
  ProviderJotaiContextDesktopBleRepair,
  useDesktopBleRepairActions,
  useDesktopBleRepairAtom,
} from '../../../states/jotai/contexts/desktopBleRepair';

function DesktopBleRepairContainerInner() {
  const [desktopBleRepairState] = useDesktopBleRepairAtom();
  const actions = useDesktopBleRepairActions();

  useEffect(() => {
    const handleDesktopBleRepairRequired = (
      payload: IAppEventBusPayload[EAppEventBusNames.DesktopBleRepairRequired],
    ) => {
      // Prevent duplicate dialogs
      if (desktopBleRepairState.isVisible) {
        return;
      }

      actions.current.showDesktopBleRepairDialog(payload);
    };

    appEventBus.on(
      EAppEventBusNames.DesktopBleRepairRequired,
      handleDesktopBleRepairRequired,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.DesktopBleRepairRequired,
        handleDesktopBleRepairRequired,
      );
    };
  }, [actions, desktopBleRepairState.isVisible]);

  return <DesktopBleRepairDialog />;
}

export function DesktopBleRepairContainer() {
  return (
    <ProviderJotaiContextDesktopBleRepair>
      <DesktopBleRepairContainerInner />
    </ProviderJotaiContextDesktopBleRepair>
  );
}
