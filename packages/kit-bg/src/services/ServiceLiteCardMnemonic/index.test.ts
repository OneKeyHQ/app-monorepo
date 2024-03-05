// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

const {
  serviceLiteCardMnemonic: { encodeMnemonic, decodeMnemonic },
} = backgroundApiProxy;

describe('liteCardMnemonicEncodeDecode', () => {
  it('should encode v01 correctly', async () => {
    expect(
      await encodeMnemonic(
        'juice nurse nasty ship hole deal device emerge easy head true fade',
      ),
    ).toEqual('1741052962627811425136991140857784951750ffff0100');
  });
  it('should decode v01 correctly', async () => {
    expect(
      await decodeMnemonic('1741052962627811425136991140857784951750ffff0100'),
    ).toEqual(
      'juice nurse nasty ship hole deal device emerge easy head true fade',
    );
  });
  it('should decode v02 correctly', async () => {
    expect(
      await decodeMnemonic('78d2f24ce306ca704f2a4545cd43a528ffff0200'),
    ).toEqual(
      'juice nurse nasty ship hole deal device emerge easy head true fade',
    );
  });
  it('should decode v00 correctly', async () => {
    expect(
      await decodeMnemonic(
        '6a75696365206e75727365206e61737479207368697020686f6c65206465616c2064657669636520656d657267652065617379206865616420747275652066616465',
      ),
    ).toEqual(
      'juice nurse nasty ship hole deal device emerge easy head true fade',
    );
  });
});
