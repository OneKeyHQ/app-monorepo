import bech32 from 'bech32';

import useParseQRCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useParseQRCode';
import { EQRCodeHandlerType } from '@onekeyhq/kit/src/views/ScanQrCode/utils/parseQRCodeHandler/type';

describe('useParseQRCode', () => {
  const { parse } = useParseQRCode();
  it('should parse as migrate', () => {
    expect(parse('onekey://migrate/192.168.1.2')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.MIGRATE,
        data: { address: '192.168.1.2' },
      }),
    );
  });
  it('should parse as animation qrcode', () => {
    expect(parse('ur://bytes/1-3/1FGsdfSEFASDFA')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ANIMATION_CODE,
        data: expect.objectContaining({
          partIndex: 1,
          partSize: 3,
          partData: '1FGsdfSEFASDFA',
          fullData: undefined,
        }),
      }),
    );
    expect(parse('ur://bytes/2-3/2FGsdfSEFASDFA')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ANIMATION_CODE,
        data: expect.objectContaining({
          partIndex: 2,
          partSize: 3,
          partData: '2FGsdfSEFASDFA',
          fullData: undefined,
        }),
      }),
    );
    expect(parse('ur://bytes/3-3/3FGsdfSEFASDFA')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ANIMATION_CODE,
        data: expect.objectContaining({
          partIndex: 3,
          partSize: 3,
          partData: '3FGsdfSEFASDFA',
          fullData: '1FGsdfSEFASDFA2FGsdfSEFASDFA3FGsdfSEFASDFA',
        }),
      }),
    );
    expect(
      parse(
        'ur:bytes/1-9/lpadascfadaxcywenbpljkhdcahkadaemejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtdkgslpgh',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ANIMATION_CODE,
        data: expect.objectContaining({
          partIndex: 1,
          partSize: 9,
          partData:
            'lpadascfadaxcywenbpljkhdcahkadaemejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtdkgslpgh',
          fullData: undefined,
        }),
      }),
    );
  });
  it('should parse as bitcoin', () => {
    expect(parse('btc://5bccc')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: { address: '5bccc' },
      }),
    );
    expect(parse('bitcoin://5bccc')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: { address: '5bccc' },
      }),
    );
  });
  it('should parse as eth', () => {
    expect(parse('eth://0x5bccc')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ETHEREUM,
        data: { address: '0x5bccc' },
      }),
    );
    expect(parse('eth:0x5bccc')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ETHEREUM,
        data: { address: '0x5bccc' },
      }),
    );
  });
  it('should parse as url', () => {
    expect(parse('https://www.google.com/search?q=onekey')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
        data: {
          urlSchema: 'https',
          urlPathList: ['www.google.com', 'search'],
          urlParamList: { 'q': 'onekey' },
        },
      }),
    );
  });
  it('should parse as wallet connect', () => {
    expect(
      parse(
        'wc:6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe@2?relay-protocol=irn&symKey=99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT,
        data: expect.objectContaining({
          topic:
            '6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe',
          version: '2',
          symKey:
            '99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355',
        }),
      }),
    );
    expect(
      parse(
        'wc:7a2eabf0-a5ab-4df5-805c-1bf50da956c7@1?bridge=https%3A%2F%2Fx.bridge.walletconnect.org&key=a1bc7b3461fc0c017288c06bbfddd4d00fa187409821b3f909f2125b33277e0d',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT,
        data: expect.objectContaining({
          topic: '7a2eabf0-a5ab-4df5-805c-1bf50da956c7',
          version: '1',
          bridge: 'https://x.bridge.walletconnect.org',
          key: 'a1bc7b3461fc0c017288c06bbfddd4d00fa187409821b3f909f2125b33277e0d',
        }),
      }),
    );
  });
  it('should parse as lightningNetwork', () => {
    const url =
      'https://LNserviceURL?tag=withdrawRequest&k1=String&minWithdrawable=MilliSatoshi&maxWithdrawable=MilliSatoshi&defaultDescription=String&callback=String';
    const encodeUrl = Buffer.from(
      bech32.encode('LNURL1', bech32.toWords(Buffer.from(url, 'utf-8')), 2000),
    ).toString('utf-8');
    expect(parse(encodeUrl)).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.LIGHTNING_NETWORK,
        data: expect.objectContaining({
          tag: 'withdrawRequest',
          k1: 'String',
        }),
      }),
    );
  });
});
