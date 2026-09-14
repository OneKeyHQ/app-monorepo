import {
  EParseTxComponentType,
  EParseTxType,
} from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IDisplayComponentSimulation,
  ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';

import {
  getPermit2ServerDisplayExtras,
  shouldUseLocalPermit2Display,
} from './permit2SignatureConfirmUtils';

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

describe('shouldUseLocalPermit2Display', () => {
  const revokeDisplay: ISignatureConfirmDisplay = {
    title: 'Revoke approval',
    components: [
      {
        type: EParseTxComponentType.Address,
        label: 'Revoke from',
        address: spender,
        tags: [],
      },
    ],
    alerts: [],
  };

  test('never forces local display without permit2 approve info', () => {
    expect(
      shouldUseLocalPermit2Display({
        hasPermit2ApproveInfo: false,
        parsedTx: null,
      }),
    ).toBe(false);
  });

  test('trusts server display only for the revokeApproval classification', () => {
    expect(
      shouldUseLocalPermit2Display({
        hasPermit2ApproveInfo: true,
        parsedTx: {
          type: EParseTxType.RevokeApproval,
          display: revokeDisplay,
        },
      }),
    ).toBe(false);
  });

  test('keeps local display when parse API classifies the revoke as a plain approve', () => {
    expect(
      shouldUseLocalPermit2Display({
        hasPermit2ApproveInfo: true,
        parsedTx: { type: EParseTxType.Approve, display: revokeDisplay },
      }),
    ).toBe(true);
  });

  test('falls back to local display when parse API returned no display', () => {
    expect(
      shouldUseLocalPermit2Display({
        hasPermit2ApproveInfo: true,
        parsedTx: { type: EParseTxType.RevokeApproval, display: null },
      }),
    ).toBe(true);
    expect(
      shouldUseLocalPermit2Display({
        hasPermit2ApproveInfo: true,
        parsedTx: null,
      }),
    ).toBe(true);
  });

  test('falls back to local display when parse API cannot classify the tx', () => {
    expect(
      shouldUseLocalPermit2Display({
        hasPermit2ApproveInfo: true,
        parsedTx: { type: EParseTxType.Unknown, display: revokeDisplay },
      }),
    ).toBe(true);
  });
});
