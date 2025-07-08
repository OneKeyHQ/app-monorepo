import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextDesktopBleRepair,
  contextAtom,
  contextAtomMethod,
  useContextData: useDesktopBleRepairContextData,
} = createJotaiContext();
export {
  ProviderJotaiContextDesktopBleRepair,
  contextAtomMethod,
  useDesktopBleRepairContextData,
};

export type IDesktopBleRepairData =
  IAppEventBusPayload[EAppEventBusNames.DesktopBleRepairRequired];

export type IDesktopBleRepairState = {
  isVisible: boolean;
  data?: IDesktopBleRepairData;
  isRepairing: boolean;
  progressStage?:
    | 'searching'
    | 'matching'
    | 'connecting'
    | 'success'
    | 'failed';
  progressMessage?: string;
};

export const { atom: desktopBleRepairAtom, use: useDesktopBleRepairAtom } =
  contextAtom<IDesktopBleRepairState>({
    isVisible: false,
    data: undefined,
    isRepairing: false,
    progressStage: undefined,
    progressMessage: undefined,
  });
