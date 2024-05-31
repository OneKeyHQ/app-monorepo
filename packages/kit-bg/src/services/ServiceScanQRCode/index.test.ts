import { parseQRCode as parse } from './utils/parseQRCode';
import { PARSE_HANDLER_NAMES } from './utils/parseQRCode/handlers';
import { EQRCodeHandlerType } from './utils/parseQRCode/type';

// yarn jest packages/kit-bg/src/services/ServiceScanQRCode/index.test.ts
describe('useParseQRCode', () => {
  it('should parse as migrate', async () => {
    expect(await parse('onekey-wallet://migrate/192.168.1.2')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.MIGRATE,
        data: { address: '192.168.1.2' },
      }),
    );
  });
  it.skip('should parse as animation qrcode', async () => {
    expect(
      await parse(
        'ur:bytes/1-9/lpadascfadaxcywenbpljkhdcahkadaemejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtdkgslpgh',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ANIMATION_CODE,
        'raw':
          'ur:bytes/1-9/lpadascfadaxcywenbpljkhdcahkadaemejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtdkgslpgh',
        data: expect.objectContaining({
          partIndexes: [0],
          partSize: 9,
          fullData: undefined,
          parts: [],
          'progress': 0.06349206349206349,
        }),
      }),
    );
    expect(
      await parse(
        'ur:bytes/201-3/lpcssoaxcfadwycynbnllocahdonecemdwecetdwecesdwendydwenehdweneydweneodweneedwenecdwenendwenemdwenetdwenesdwemdydwemehdwemeydwemeodwemeedwemecdwemendwememdwemetdwemesdwetdydwetehdweteydweteodweteedwetecdwetendwetemdwetetdwetesdwesdydwesehdweseydweseodweseedwesecdwesendwesemdwesetdwesesdwehdydydwehdyehdwehdyeydwehdyeodwehdyeedwehdyecdwehdyendwehdyemdwehdyetdwemjzhhlf',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ANIMATION_CODE,
        data: expect.objectContaining({
          partIndexes: [1],
          partSize: 3,
          fullData: undefined,
        }),
      }),
    );
    expect(
      await parse(
        'ur:bytes/202-3/lpcssgaxcfadwycynbnllocahdonehdyesdwehehdydwehehehdweheheydweheheodweheheedwehehecdwehehendwehehemdwehehetdwehehesdweheydydweheyehdweheyeydweheyeodweheyeedweheyecdweheyendweheyemdweheyetdweheyesdweheodydweheoehdweheoeydweheoeodweheoeedweheoecdweheoendweheoemdweheoetdweheoesdweheedydweheeehdweheeeydweheeeodweheeeedweheeecdweheeendweheeemdweheeetdweheeeshlaebbcfdiia',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ANIMATION_CODE,
        data: expect.objectContaining({
          partIndexes: [2],
          partSize: 3,
          fullData: undefined,
        }),
      }),
    );
    expect(
      await parse(
        'ur:bytes/204-3/lpcssfaxcfadwycynbnllocahdonhlamzefweseheeesdldneydweodwdneneceheyeodadnesdweneeecdnenehehdtehenfndwenfnetdreeehfhdneheeecdwemesehdrfneyemdtehemeedweeemeedtfteydycleheteodwfrecemdseeeyeydieheteedwftendydieneoftdtehetesdwftfmeodseeeofmdnehesdydwfretendsfneoftdtehfmfhdwfnenesclfteefscleheheedydteodmdtdrdtemdsehehfseodeecdtdpdwdteodnehdyeeendeehdkdmdedtfnguaednprmtns',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.ANIMATION_CODE,
        data: expect.objectContaining({
          partIndexes: [0, 1, 2],
          partSize: 3,
          fullData:
            '[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149]',
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
        handlers: PARSE_HANDLER_NAMES.all,
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
  it('should parse as solana', async () => {
    expect(
      await parse(
        'solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=1&label=Michael&message=Thanks%20for%20all%20the%20fish&memo=OrderId12345',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.SOLANA,
        data: expect.objectContaining({
          recipient: 'mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN',
          amount: '1',
          label: 'Michael',
          message: 'Thanks for all the fish',
          memo: 'OrderId12345',
        }),
      }),
    );
    expect(
      await parse(
        'solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=0.01&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.SOLANA,
        data: expect.objectContaining({
          recipient: 'mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN',
          amount: '0.01',
          // eslint-disable-next-line spellcheck/spell-checker
          splToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        }),
      }),
    );
    expect(
      await parse(
        'solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=0.01&reference=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&reference=HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.SOLANA,
        data: expect.objectContaining({
          recipient: 'mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN',
          amount: '0.01',
          reference: [
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
          ],
        }),
      }),
    );
    expect(
      await parse(
        'solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?label=Michael',
      ),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.SOLANA,
        data: expect.objectContaining({
          recipient: 'mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN',
          label: 'Michael',
        }),
      }),
    );
  });
  it('should parse as url', async () => {
    expect(await parse('https://www.google.com/search?q=onekey')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.URL,
        data: {
          'hostname': 'www.google.com',
          'origin': 'https://www.google.com',
          'pathname': '/search',
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
          'hostname': 'search',
          'origin': 'null',
          'pathname': '/list',
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
