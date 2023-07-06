import { InscribeAccount } from './InscribeAccount';

describe('InscribeAccount', () => {
  it('should InscribeAccount class correct', () => {
    const account = new InscribeAccount({
      privateKey:
        'c66c0060ec6ccdad8b6b538f837792a8993e546ac5f54efb21f24c34bc111111',
      network: 'testnet',
    });
    const script = [account.publicKeyBytes, 'OP_CHECKSIG'];
    const addressInfo = account.createAddressInfo({
      script,
    });
    expect(addressInfo.address).toEqual(
      'tb1puvc5kvmhhg85l6j222dcd43l46gmrh8ra5cgwpafqerpracs0q0snt8uc9',
    );
  });
});
