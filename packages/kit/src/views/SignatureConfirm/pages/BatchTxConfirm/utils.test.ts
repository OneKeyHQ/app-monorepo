import { createIntl, createIntlCache } from 'react-intl';

import enUS from '@onekeyhq/shared/src/locale/json/en_US.json';

import { formatRecipientLine, normalizeNativePrice } from './utils';

const intl = createIntl(
  {
    locale: 'en-US',
    messages: enUS as Record<string, string>,
  },
  createIntlCache(),
);

describe('formatRecipientLine', () => {
  it('formats a single external recipient', () => {
    expect(
      formatRecipientLine({
        recipient: 'tb1qexample',
        extraRecipientCount: 0,
        intl,
      }),
    ).toBe('To tb1qexample');
  });

  it('appends +N for extra external recipients', () => {
    expect(
      formatRecipientLine({
        recipient: 'tb1qexample',
        extraRecipientCount: 2,
        intl,
      }),
    ).toBe('To tb1qexample +2');
  });

  it('formats a pure self-transfer psbt like any other recipient (own address in `recipient`)', () => {
    expect(
      formatRecipientLine({
        recipient: 'tb1pownaddress',
        extraRecipientCount: 0,
        intl,
      }),
    ).toBe('To tb1pownaddress');
  });

  it('keeps the generic fallback when no recipient address is decodable', () => {
    expect(
      formatRecipientLine({
        recipient: '',
        extraRecipientCount: 0,
        intl,
      }),
    ).toBe('To multiple outputs');
  });
});

describe('normalizeNativePrice', () => {
  it('passes through a valid positive numeric price', () => {
    expect(normalizeNativePrice(63_725)).toBe('63725');
    expect(normalizeNativePrice('63725.5')).toBe('63725.5');
  });

  it('rejects the server "--" no-price sentinel (signet)', () => {
    expect(normalizeNativePrice('--')).toBeUndefined();
  });

  it('rejects zero prices so testnets do not render a $0.00 fiat line', () => {
    expect(normalizeNativePrice('0')).toBeUndefined();
    expect(normalizeNativePrice(0)).toBeUndefined();
  });

  it('rejects missing and non-finite prices', () => {
    expect(normalizeNativePrice(undefined)).toBeUndefined();
    expect(normalizeNativePrice(NaN)).toBeUndefined();
    expect(normalizeNativePrice(Infinity)).toBeUndefined();
    expect(normalizeNativePrice('not-a-number')).toBeUndefined();
  });

  it('rejects negative prices', () => {
    expect(normalizeNativePrice(-1)).toBeUndefined();
    expect(normalizeNativePrice('-0.5')).toBeUndefined();
  });
});
