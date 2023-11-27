// jest tests
import { InvalidAccount, InvalidAddress, TooManyHWPassphraseWallets } from '.';

describe('OneKey Error tests', () => {
  it('common tests', () => {
    const e1 = new TooManyHWPassphraseWallets(12);
    expect(e1.constructorName).toBe('TooManyHWPassphraseWallets');
    expect(e1.message).toBe('TooManyHWPassphraseWallets');
  });

  it('default message', () => {
    let e = new InvalidAccount();
    expect(e.message).toBe('InvalidAccount');
    expect(e.constructorName).toBe('InvalidAccount');
    expect(e.code).toBe(-99999);

    // e = new InvalidAccount('hello');
    e = new InvalidAddress();
    expect(e.message).toBe('InvalidAddress');
  });

  it('custom message', () => {
    const e = new InvalidAccount({ message: 'test111' });
    expect(e.message).toBe('test111');
  });

  it('default key', () => {
    const e = new InvalidAccount();
    expect(e.key).toBe('msg__engine__account_not_activated');
  });

  it('custom key', () => {
    const e = new InvalidAccount({ key: 'Handling_Fee' });
    expect(e.key).toBe('Handling_Fee');
  });

  it('custom message and key', () => {
    let e = new InvalidAccount();
    expect(e.message).toBe('InvalidAccount');
    expect(e.key).toBe('msg__engine__account_not_activated');

    e = new InvalidAccount({
      message: 'hello',
      key: 'Handling_Fee',
    });
    expect(e.message).toBe('hello');
    expect(e.key).toBe('Handling_Fee');
  });
});
