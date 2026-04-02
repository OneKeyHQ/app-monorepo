import {
  parseXrpDestinationTag,
  XRP_DESTINATION_TAG_MAX,
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
  });

  it('returns undefined for values above XRP destination tag max', () => {
    expect(parseXrpDestinationTag('4294967296')).toBeUndefined();
  });

  it('supports surrounding whitespace by trimming', () => {
    expect(parseXrpDestinationTag('  123  ')).toBe(123);
  });
});
