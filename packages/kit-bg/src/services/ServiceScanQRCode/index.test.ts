import { parseQRCode as parse } from './utils/parseQRCode';
import { EQRCodeHandlerType } from './utils/parseQRCode/type';

describe('useParseQRCode', () => {
  it('should parse as migrate', async () => {
    expect(await parse('onekey-wallet://migrate/192.168.1.2')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.MIGRATE,
        data: { address: '192.168.1.2' },
      }),
    );
  });
  it('should parse as animation qrcode', async () => {
    expect(await parse('ur://bytes/1-3/1FGsdfSEFASDFA')).toEqual(
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
    expect(await parse('ur://bytes/2-3/2FGsdfSEFASDFA')).toEqual(
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
    expect(await parse('ur://bytes/3-3/3FGsdfSEFASDFA')).toEqual(
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
      await parse(
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
  it('should parse as bitcoin', async () => {
    expect(await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
        }),
      }),
    );
    expect(await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
        }),
      }),
    );
    expect(await parse('bitcoin://1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?label=Luke-Jr'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          label: 'Luke-Jr',
        }),
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=0'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          amount: 0,
        }),
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=0'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          amount: 0,
        }),
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=-1'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=-1.00'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=two'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=NaN'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=Infinity'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=1'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          amount: 1,
        }),
      }),
    );
    expect(
      await parse('bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=1.00'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          amount: 1,
        }),
      }),
    );
    expect(
      await parse(
        'bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=20.3&label=Luke-Jr',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          amount: 20.3,
          label: 'Luke-Jr',
        }),
      }),
    );
    expect(
      await parse(
        'bitcoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=50&label=Luke-Jr&message=Donation%20for%20project%20xyz',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          amount: 50,
          label: 'Luke-Jr',
          message: 'Donation for project xyz',
        }),
      }),
    );
    expect(
      await parse(
        'BitCoin:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=1&custom=foobar',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          amount: 1,
          paramList: { custom: 'foobar' },
        }),
      }),
    );
    expect(
      await parse(
        'BITCOIN:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH?amount=0.200000&r=https%3A%2F%2Fbitpay.com%2Fi%2Fxxxxxxxxxxxxxxxxxxxxxx',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
          amount: 0.2,
          paramList: { r: 'https://bitpay.com/i/xxxxxxxxxxxxxxxxxxxxxx' },
        }),
      }),
    );
    expect(
      await parse('other:1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', {
        bitcoinUrlScheme: 'other',
      }),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.BITCOIN,
        data: expect.objectContaining({
          address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
        }),
      }),
    );
  });
  it('should parse as eth EIP-681', async () => {
    expect(
      await parse(
        'ethereum:0x178e3e6c9f547A00E33150F7104427ea02cfc747@1?value=1e8',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ETHEREUM,
        data: expect.objectContaining({
          address: '0x178e3e6c9f547A00E33150F7104427ea02cfc747',
          id: '1',
        }),
      }),
    );
    expect(
      await parse(
        'ethereum:0x3dD3DfaAdA4d6765Ae19b8964E2BAC0139eeCb40@5/transfer?address=0x178e3e6c9f547A00E33150F7104427ea02cfc747&uint256=1e7',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ETHEREUM,
        data: expect.objectContaining({
          address: '0x178e3e6c9f547A00E33150F7104427ea02cfc747',
          id: '5',
        }),
      }),
    );
  });
  it('should parse as eth ECIP-1037', async () => {
    expect(
      await parse('ethereum:0xCe5ED529977b08f87CBc207ebC216859820461eE&id=61'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ETHEREUM,
        data: expect.objectContaining({
          address: '0xCe5ED529977b08f87CBc207ebC216859820461eE',
        }),
      }),
    );
    expect(
      await parse(
        'ethereum:0xCe5ED529977b08f87CBc207ebC216859820461eE&id=61?amount=50&label=DontPanic&message=Purchase%20token%20for%20project%20xyz%20ICO',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ETHEREUM,
        data: expect.objectContaining({
          address: '0xCe5ED529977b08f87CBc207ebC216859820461eE',
        }),
      }),
    );
  });
  it('should parse as url', async () => {
    expect(await parse('https://www.google.com/search?q=onekey')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
        data: {
          url: 'https://www.google.com/search?q=onekey',
          urlSchema: 'https',
          urlPathList: ['www.google.com', 'search'],
          urlParamList: { 'q': 'onekey' },
        },
      }),
    );
  });
  it('should parse as deeplink', async () => {
    expect(await parse('onekey-wallet://search/list?q=onekey')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.DEEPLINK,
        data: {
          url: 'onekey-wallet://search/list?q=onekey',
          urlSchema: 'onekey-wallet',
          urlPathList: ['search', 'list'],
          urlParamList: { 'q': 'onekey' },
        },
      }),
    );
  });
  it('should parse as unknown', async () => {
    expect(await parse('abcd')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.UNKNOWN,
        data: 'abcd',
        raw: 'abcd',
      }),
    );
  });
  it('should parse as wallet connect', async () => {
    expect(
      await parse(
        'wc:6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe@2?relay-protocol=irn&symKey=99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT,
        data: expect.objectContaining({
          version: '2',
          wcUri:
            'wc:6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe@2?relay-protocol=irn&symKey=99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355',
        }),
      }),
    );
    expect(
      await parse(
        'onekey-wallet://wc?uri=wc%3A6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe%402%3Frelay-protocol%3Dirn%26symKey%3D99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT,
        data: expect.objectContaining({
          version: '2',
          wcUri:
            'wc:6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe@2?relay-protocol=irn&symKey=99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355',
        }),
      }),
    );
  });
});
