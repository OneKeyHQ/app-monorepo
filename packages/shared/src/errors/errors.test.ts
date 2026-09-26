// jest tests
import {
  InvalidAccount,
  InvalidAddress,
  TooManyHWPassphraseWallets,
  UserCancelError,
} from '.';

import { ETranslations } from '../locale';

import { isUserCancelError } from './utils/errorUtils';

/*
yarn jest packages/shared/src/errors/errors.test.ts
*/

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
    expect(e.code).toBe(-99_999);

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
    expect(e.key).toBe(ETranslations.send_engine_account_not_activated);
  });

  it('custom key', () => {
    const e = new InvalidAccount({ key: 'Handling_Fee' as any });
    expect(e.key).toBe('Handling_Fee');
  });

  it('custom message and key', () => {
    let e = new InvalidAccount();
    expect(e.message).toBe('InvalidAccount');
    expect(e.key).toBe(ETranslations.send_engine_account_not_activated);

    e = new InvalidAccount({
      message: 'hello',
      key: 'Handling_Fee' as any,
    });
    expect(e.message).toBe('hello');
    expect(e.key).toBe('Handling_Fee');
  });
});

describe('isUserCancelError', () => {
  it('matches UserCancelError by class, not by message', () => {
    expect(isUserCancelError(new UserCancelError())).toBe(true);
    // a custom message must not change the verdict
    expect(isUserCancelError(new UserCancelError({ message: '已取消' }))).toBe(
      true,
    );
  });

  it('does not match a bare Error with the old sentinel text', () => {
    expect(isUserCancelError(new Error('User cancelled'))).toBe(false);
    expect(isUserCancelError(new InvalidAccount())).toBe(false);
    expect(isUserCancelError(undefined)).toBe(false);
  });

  it('does not auto toast', () => {
    expect(new UserCancelError().autoToast).toBe(false);
  });
});
