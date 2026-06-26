import { EReceiverMode } from '@onekeyhq/shared/types/bulkSend';

import {
  hasBulkSendAddressAmountLine,
  parseBulkSendAddressLine,
  parseBulkSendAddressLines,
} from './addressLineUtils';

describe('BulkSend address line utils', () => {
  it('parses address-only lines', () => {
    expect(parseBulkSendAddressLine(' 0xabc ')).toEqual({
      isValid: true,
      mode: EReceiverMode.AddressOnly,
      address: '0xabc',
    });
  });

  it('parses comma-separated address and amount lines', () => {
    expect(parseBulkSendAddressLine('0xabc,1.23')).toEqual({
      isValid: true,
      mode: EReceiverMode.AddressAndAmount,
      address: '0xabc',
      amount: '1.23',
    });
  });

  it('parses equals-separated address and amount lines', () => {
    expect(parseBulkSendAddressLine('0xabc = 1.23')).toEqual({
      isValid: true,
      mode: EReceiverMode.AddressAndAmount,
      address: '0xabc',
      amount: '1.23',
    });
  });

  it('parses whitespace and tab separated table rows', () => {
    expect(parseBulkSendAddressLine('0xabc 1.23')).toEqual({
      isValid: true,
      mode: EReceiverMode.AddressAndAmount,
      address: '0xabc',
      amount: '1.23',
    });
    expect(parseBulkSendAddressLine('0xdef\t4.56')).toEqual({
      isValid: true,
      mode: EReceiverMode.AddressAndAmount,
      address: '0xdef',
      amount: '4.56',
    });
  });

  it('marks malformed amount lines as invalid', () => {
    expect(parseBulkSendAddressLine('0xabc,1,2')).toEqual({
      isValid: false,
      mode: EReceiverMode.AddressAndAmount,
    });
    expect(parseBulkSendAddressLine('0xabc = ')).toEqual({
      isValid: false,
      mode: EReceiverMode.AddressAndAmount,
    });
    expect(parseBulkSendAddressLine('0xabc 1.23 memo')).toEqual({
      isValid: false,
      mode: EReceiverMode.AddressAndAmount,
    });
  });

  it('ignores empty lines', () => {
    expect(parseBulkSendAddressLine('   ')).toBeUndefined();
  });

  it('parses multiple input lines and skips empty lines', () => {
    expect(parseBulkSendAddressLines('0xabc\n\n0xdef\t4.56')).toEqual([
      { address: '0xabc' },
      { address: '0xdef', amount: '4.56' },
    ]);
  });

  it('detects address and amount lines from the shared parser', () => {
    expect(hasBulkSendAddressAmountLine('0xabc\n0xdef')).toBe(false);
    expect(hasBulkSendAddressAmountLine('0xabc\n0xdef 4.56')).toBe(true);
    expect(hasBulkSendAddressAmountLine('0xabc,')).toBe(true);
  });
});
