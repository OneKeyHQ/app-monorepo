import { EDeviceType } from '@onekeyfe/hd-shared';

import { SendScene } from './send';

import type { IMethodDecoratorMetadata } from '../../../types';

class TestSendScene extends SendScene {
  emissions: Array<{
    methodName: string;
    args: unknown[];
    metadataList: IMethodDecoratorMetadata[];
  }> = [];

  override _emitLog(
    methodName: string,
    args: unknown[],
    metadataList: IMethodDecoratorMetadata[],
  ) {
    this.emissions.push({ methodName, args, metadataList });
  }
}

describe('sendConfirm analytics payload', () => {
  it('emits wallet attribution once and preserves the existing flow fields', () => {
    const scene = new TestSendScene();
    scene.startNewFlow('send-flow');
    scene.addressInput({ addressInputMethod: 'paste' });
    scene.emissions = [];

    scene.sendConfirm({
      network: 'evm--1',
      walletType: 'hw',
      hwDeviceType: EDeviceType.Pro2,
      txnType: 'transfer',
      txnParseType: undefined,
      txnOrigin: undefined,
      interactContract: undefined,
      tokenType: 'Token',
      tokenSymbol: 'ETH',
      tokenAddress: undefined,
      feeToken: undefined,
      feeFiatValue: undefined,
      tronIsResourceRentalNeeded: undefined,
      tronIsResourceRentalEnabled: undefined,
      tronIsSwapTrxEnabled: undefined,
      tronPayCoinCode: undefined,
      tronUseCredit: undefined,
      tronUseRedemptionCode: undefined,
      tronIsCreditAutoClaimed: undefined,
    });

    expect(scene.emissions).toHaveLength(1);
    expect(scene.emissions[0]).toEqual({
      methodName: 'sendConfirm',
      args: [
        expect.objectContaining({
          network: 'evm--1',
          walletType: 'hw',
          hwDeviceType: 'pro2',
          sendFlowId: 'send-flow',
          addressInputMethod: 'paste',
        }),
      ],
      metadataList: [{ level: 'info', type: 'server' }],
    });
    expect(scene.sendFlowId).toBeUndefined();
  });
});
