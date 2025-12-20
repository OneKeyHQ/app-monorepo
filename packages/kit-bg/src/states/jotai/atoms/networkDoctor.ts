import type {
  IDiagnosticProgress,
  INetworkCheckup,
} from '@onekeyhq/shared/src/modules/NetworkDoctor';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type INetworkDoctorStatus = 'idle' | 'running' | 'completed' | 'failed';

export type INetworkDoctorState = {
  status: INetworkDoctorStatus;
  progress: IDiagnosticProgress | null;
  result: INetworkCheckup | null;
  error: string | null;
};

export const {
  target: networkDoctorStateAtom,
  use: useNetworkDoctorStateAtom,
} = globalAtom<INetworkDoctorState>({
  name: EAtomNames.networkDoctorStateAtom,
  initialValue: {
    status: 'idle',
    progress: null,
    result: null,
    error: null,
  },
  persist: false,
});
