// jest tests
import {
  InvalidAccount,
  InvalidAddress,
  InvalidSameAddress,
  TestAppError3,
  TooManyHWPassphraseWallets,
} from '.';

describe('OneKey Error tests', () => {
  it('common tests', () => {
    const e1 = new TooManyHWPassphraseWallets(12);
    expect(e1.constructorName).toBe('TooManyHWPassphraseWallets');
    expect(e1.message).toBe('NumberLimit');
  });

  it('default error message', () => {
    let e = new InvalidAccount();
    expect(e.message).toBe('InvalidAccount');
    expect(e.constructorName).toBe('InvalidAccount');
    expect(e.code).toBe(-99999);

    e = new InvalidAccount({ message: 'test111' });
    expect(e.message).toBe('test111');

    // e = new InvalidAccount('hello');
    e = new InvalidAddress();
    expect(e.message).toBe('InvalidAddress');
  });

  it('custom key  ', () => {
    let e = new InvalidAccount();
    expect(e.key).toBe('msg__engine__account_not_activated');

    e = new InvalidAccount({ key: 'Handling_Fee' });
    expect(e.key).toBe('Handling_Fee');

    e = new InvalidSameAddress({ key: 'Only_you_can_unlock_your_wallet' });
    expect(e.key).toBe('Only_you_can_unlock_your_wallet');
  });

  it('custom key 2 ', () => {
    let e = new InvalidSameAddress({
      key: 'Only_you_can_unlock_your_wallet',
    });
    expect(e.key).toBe('Only_you_can_unlock_your_wallet');

    e = new InvalidSameAddress();
    expect(e.key).toBe('form__address_cannot_send_to_myself');
    expect(e.message).toBe('InvalidSameAddress');

    e = new InvalidSameAddress({
      message: 'hello',
    });
    expect(e.key).toBe('form__address_cannot_send_to_myself');
    expect(e.message).toBe('hello');

    e = new InvalidSameAddress('hi');
    expect(e.message).toBe('hi');
    expect(e.constructorName).toBe('InvalidSameAddress');
    expect(e.key).toBe('form__address_cannot_send_to_myself');
  });

  it('not set default key ', () => {
    let e = new TestAppError3('hi');
    expect(e.message).toBe('hi');
    expect(e.key).toBe('onekey_error');

    e = new TestAppError3();
    expect(e.message).toBe('Unknown Onekey Internal Error. ');
    expect(e.key).toBe('onekey_error');
  });
});
