import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IDisplayComponentSimulation,
  ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';

import { getPermit2ServerDisplayExtras } from './permit2SignatureConfirmUtils';

const permit2Address = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const spender = '0x4c82d1fbfe28c977cbb58d8c7ff8fcf9f70a2cca';

describe('Permit2 signature confirmation utils', () => {
  test('keeps only server simulation and alerts', () => {
    const simulationComponent: IDisplayComponentSimulation = {
      type: EParseTxComponentType.Simulation,
      label: 'Simulation',
      assets: [],
    };
    const display: ISignatureConfirmDisplay = {
      title: 'Approve token',
      components: [
        {
          type: EParseTxComponentType.Address,
          label: 'Spender',
          address: permit2Address,
          tags: [],
        },
        {
          type: EParseTxComponentType.Address,
          label: 'Interact with',
          address: spender,
          tags: [],
        },
        simulationComponent,
      ],
      alerts: ['Server risk alert'],
    };

    expect(getPermit2ServerDisplayExtras(display)).toEqual({
      simulationComponents: [simulationComponent],
      alerts: ['Server risk alert'],
    });
  });
});
