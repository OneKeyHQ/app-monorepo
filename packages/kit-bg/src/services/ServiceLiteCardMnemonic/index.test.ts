import { decodeMnemonic, encodeMnemonic } from './utils/liteCardMnemonic';

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
  it('should encode v01 correctly when the mnemonic ends with abandon', async () => {
    expect(
      await encodeMnemonic(
        'oxygen vanish install dinner abandon drum abandon garage kid abandon abandon abandon',
      ),
    ).toEqual('302791640924776777142343849202ffff0100');
  });
  it('should decode v01 correctly when the mnemonic ends with abandon', async () => {
    expect(
      await decodeMnemonic('302791640924776777142343849202ffff0100'),
    ).toEqual(
      'oxygen vanish install dinner abandon drum abandon garage kid abandon abandon abandon',
    );
  });
  it('should decode v02 correctly when the mnemonic ends with abandon', async () => {
    expect(
      await decodeMnemonic('9e5e29d59f2000870002fb7a40000000ffff0200'),
    ).toEqual(
      'oxygen vanish install dinner abandon drum abandon garage kid abandon abandon abandon',
    );
  });
  it('should decode v00 correctly when the mnemonic ends with abandon', async () => {
    expect(
      await decodeMnemonic(
        '6f787967656e2076616e69736820696e7374616c6c2064696e6e6572206162616e646f6e206472756d206162616e646f6e20676172616765206b6964206162616e646f6e206162616e646f6e206162616e646f6e',
      ),
    ).toEqual(
      'oxygen vanish install dinner abandon drum abandon garage kid abandon abandon abandon',
    );
  });
});
