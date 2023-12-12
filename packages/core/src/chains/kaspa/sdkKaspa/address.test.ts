import { isValidAddress } from './address';

jest.setTimeout(3 * 60 * 1000);

describe('Kaspa Address Tests', () => {
  it('kaspa validate address success', () => {
    const isValid = isValidAddress(
      'kaspa:qpq55rv39sa592frxvklh8kztvm8ntw3gje20xsdw9snqk0gwnqaqvlwewmqa',
      'kaspa',
    );

    expect(isValid).toBe(true);
  });

  it('kaspa validate address error 1', () => {
    const isValid = isValidAddress(
      'bitcoin:qpq55rv39sa592frxvklh8kztvm8ntw3gje20xsdw9snqk0gwnqaqvlwewmqa',
      'kaspa',
    );

    expect(isValid).toBe(false);
  });

  it('kaspa validate address error 2', () => {
    const isValid = isValidAddress(
      'kaspa:qpq55rv39sa592frxvklh8kztvm8ntw3gje20xsdw9snqk0gwnqaqvlwewmq',
      'kaspa',
    );

    expect(isValid).toBe(false);
  });

  it('kaspa validate address error 3', () => {
    const isValid = isValidAddress(
      'kaspa:qpq55rv39sa592frxvklh8kztvm8ntw3gje20xsdw9snqk0gwnqaqvlwewmqb',
      'kaspa',
    );

    expect(isValid).toBe(false);
  });
});

export {};
