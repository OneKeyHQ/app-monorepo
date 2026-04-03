import {
  XRP_DESTINATION_TAG_MAX,
  parseXrpDestinationTag,
} from './destinationTagUtils';

describe('parseXrpDestinationTag', () => {
  it('parses valid uint32 destination tags', () => {
    expect(parseXrpDestinationTag('0')).toBe(0);
    expect(parseXrpDestinationTag('1')).toBe(1);
    expect(parseXrpDestinationTag('123')).toBe(123);
    expect(parseXrpDestinationTag(String(XRP_DESTINATION_TAG_MAX))).toBe(
      XRP_DESTINATION_TAG_MAX,
    );
  });

  it('returns undefined for empty values', () => {
    expect(parseXrpDestinationTag('')).toBeUndefined();
    expect(parseXrpDestinationTag('   ')).toBeUndefined();
    expect(parseXrpDestinationTag(undefined)).toBeUndefined();
  });

  it('returns undefined for malformed integers', () => {
    expect(parseXrpDestinationTag('-1')).toBeUndefined();
    expect(parseXrpDestinationTag('01')).toBe(1);
    expect(parseXrpDestinationTag('1.2')).toBeUndefined();
    expect(parseXrpDestinationTag('1e2')).toBeUndefined();
    expect(parseXrpDestinationTag('abc')).toBeUndefined();
    expect(parseXrpDestinationTag(' 123')).toBeUndefined();
    expect(parseXrpDestinationTag('123 ')).toBeUndefined();
    expect(parseXrpDestinationTag('123\n')).toBeUndefined();
    expect(parseXrpDestinationTag('12\r3')).toBeUndefined();
  });

  it('returns undefined for values above XRP destination tag max', () => {
    expect(parseXrpDestinationTag('4294967296')).toBeUndefined();
  });

  it('returns undefined when input includes surrounding whitespace', () => {
    expect(parseXrpDestinationTag('  123  ')).toBeUndefined();
  });
});
