// yarn jest packages/kit-bg/src/services/ServiceScanQRCode/handlePaymentUri.test.ts
/* eslint-disable @typescript-eslint/no-unsafe-return */

import ServiceScanQRCode from '.';

import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    scanQrCode: {
      parseQrCode: {
        parsedQrCode: jest.fn(),
      },
    },
  },
}));

const mockBackgroundApi = {} as any;

describe('ServiceScanQRCode.handlePaymentUri', () => {
  let service: ServiceScanQRCode;

  beforeEach(() => {
    service = new ServiceScanQRCode({ backgroundApi: mockBackgroundApi });
  });

  it('parses a valid ethereum: URI into structured data', async () => {
    const result = await service.handlePaymentUri({
      uri: 'ethereum:0x3dD3DfaAdA4d6765Ae19b8964E2BAC0139eeCb40@1?value=1e17',
    });
    expect(result.type).toBe(EQRCodeHandlerType.ETHEREUM);
    expect(result.data).toMatchObject({
      address: '0x3dD3DfaAdA4d6765Ae19b8964E2BAC0139eeCb40',
    });
  });

  it('throws OneKeyError for bitcoin: URI (not supported in minimal integration)', async () => {
    await expect(
      service.handlePaymentUri({
        uri: 'bitcoin:bc1q...?amount=0.001',
      }),
    ).rejects.toThrow(OneKeyError);
  });

  it('throws OneKeyError for non-URI string', async () => {
    await expect(
      service.handlePaymentUri({ uri: 'not a uri' }),
    ).rejects.toThrow(OneKeyError);
  });

  it('throws OneKeyError for empty URI', async () => {
    await expect(service.handlePaymentUri({ uri: '' })).rejects.toThrow(
      OneKeyError,
    );
  });

  it('throws OneKeyError for malformed ethereum: URI (no address)', async () => {
    await expect(
      service.handlePaymentUri({ uri: 'ethereum:?value=1e17' }),
    ).rejects.toThrow(OneKeyError);
  });
});
