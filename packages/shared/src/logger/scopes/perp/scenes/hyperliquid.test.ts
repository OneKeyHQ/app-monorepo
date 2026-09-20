import { HyperLiquidScene, stripSensitiveFields } from './hyperliquid';

const accountAddress = '0x1111111111111111111111111111111111111111';
const exchangeAccountAddress = '0x2222222222222222222222222222222222222222';

describe('hyperliquid log payload', () => {
  test('sends precheck failures through the server logger', () => {
    const scene = new HyperLiquidScene();
    const emit = jest.spyOn(scene, '_emitLog').mockImplementation(() => {});
    scene.preTransferCheckFailure({
      reason: 'requestFailed',
      httpStatus: 500,
      fallbackApplied: true,
    });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      'preTransferCheckFailure',
      [{ reason: 'requestFailed', httpStatus: 500, fallbackApplied: true }],
      [expect.objectContaining({ type: 'server' })],
    );
  });

  test('drops wallet addresses nested inside extra.originalParams', () => {
    const payload = stripSensitiveFields({
      accountAddress,
      exchangeAccountAddress,
      walletType: 'hd',
      status: 'success',
      duration: 12,
      request: { orders: [], grouping: 'positionTpsl' as const },
      extra: {
        originalParams: {
          assetId: 1,
          expectedAccountAddress: accountAddress,
          positionSize: '0.5',
          isBuy: true,
          tpTriggerPx: '100',
        },
        hasTp: true,
        hasSl: false,
      },
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(accountAddress);
    expect(serialized).not.toContain(exchangeAccountAddress);
    expect(payload.extra).toEqual({
      originalParams: {
        assetId: 1,
        positionSize: '0.5',
        isBuy: true,
        tpTriggerPx: '100',
      },
      hasTp: true,
      hasSl: false,
    });
    expect(payload.request).toEqual({ orders: [], grouping: 'positionTpsl' });
    expect(payload.status).toBe('success');
  });

  test('drops account keys inside arrays of nested params', () => {
    const payload = stripSensitiveFields({
      accountAddress,
      exchangeAccountAddress,
      walletType: 'hd',
      status: 'fail',
      duration: 3,
      request: { cancels: [] },
      extra: {
        originalParams: [
          { assetId: 1, oid: 10, accountAddress },
          { assetId: 2, oid: 11, expectedAccountAddress: accountAddress },
        ],
        cancelCount: 2,
      },
    });

    expect(JSON.stringify(payload)).not.toContain(accountAddress);
    expect(payload.extra).toEqual({
      originalParams: [
        { assetId: 1, oid: 10 },
        { assetId: 2, oid: 11 },
      ],
      cancelCount: 2,
    });
  });

  test('leaves payloads without extra unchanged apart from the account context', () => {
    const payload = stripSensitiveFields({
      accountAddress,
      exchangeAccountAddress,
      walletType: 'hw',
      status: 'success',
      duration: 1,
      request: { leverage: 5 },
      response: { status: 'ok' },
    });

    expect(payload).toEqual({
      walletType: 'hw',
      status: 'success',
      duration: 1,
      request: { leverage: 5 },
      response: { status: 'ok' },
    });
    expect(payload).not.toHaveProperty('extra');
  });
});
