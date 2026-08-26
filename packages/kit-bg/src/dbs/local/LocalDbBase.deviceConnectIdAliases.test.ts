import {
  collectDeviceConnectIdAliases,
  isStaleDeviceConnectIdAliasRecord,
} from './LocalDbBase';

describe('collectDeviceConnectIdAliases', () => {
  it('normalizes casing and whitespace and drops empty values', () => {
    expect(
      collectDeviceConnectIdAliases({
        connectId: ' PRB09B0058A ',
        usbConnectId: undefined,
        bleConnectId: '714D4C59EF4AF3DF00D92885755C4A58',
      }),
    ).toEqual(['prb09b0058a', '714d4c59ef4af3df00d92885755c4a58']);
  });

  it('returns an empty list when no alias is persisted', () => {
    expect(
      collectDeviceConnectIdAliases({
        connectId: '',
        usbConnectId: null,
        bleConnectId: undefined,
      }),
    ).toEqual([]);
  });
});

describe('isStaleDeviceConnectIdAliasRecord', () => {
  const keepDbDeviceId = 'db-live-device';
  const verifiedDeviceId = 'POST_WIPE_DEVICE_ID';
  const aliases = ['prb09b0058a', '714d4c59ef4af3df00d92885755c4a58'];
  const staleCandidate = {
    id: 'db-stale-pre-wipe',
    deviceId: 'PRE_WIPE_DEVICE_ID',
    connectId: 'PRB09B0058A',
    usbConnectId: undefined,
    bleConnectId: undefined,
  };

  it('flags a wipe leftover sharing the serial connectId', () => {
    expect(
      isStaleDeviceConnectIdAliasRecord({
        candidate: staleCandidate,
        keepDbDeviceId,
        verifiedDeviceId,
        aliases,
      }),
    ).toBe(true);
  });

  it('matches aliases case-insensitively on any connect-id field', () => {
    expect(
      isStaleDeviceConnectIdAliasRecord({
        candidate: {
          ...staleCandidate,
          connectId: '',
          bleConnectId: '714D4C59EF4AF3DF00D92885755C4A58',
        },
        keepDbDeviceId,
        verifiedDeviceId,
        aliases,
      }),
    ).toBe(true);
  });

  it('never flags the record being kept', () => {
    expect(
      isStaleDeviceConnectIdAliasRecord({
        candidate: { ...staleCandidate, id: keepDbDeviceId },
        keepDbDeviceId,
        verifiedDeviceId,
        aliases,
      }),
    ).toBe(false);
  });

  it('never flags a record without a persisted identity', () => {
    expect(
      isStaleDeviceConnectIdAliasRecord({
        candidate: { ...staleCandidate, deviceId: undefined },
        keepDbDeviceId,
        verifiedDeviceId,
        aliases,
      }),
    ).toBe(false);
  });

  it('never flags a record whose identity matches the live device', () => {
    expect(
      isStaleDeviceConnectIdAliasRecord({
        candidate: { ...staleCandidate, deviceId: verifiedDeviceId },
        keepDbDeviceId,
        verifiedDeviceId,
        aliases,
      }),
    ).toBe(false);
  });

  it('never flags a record without an alias collision', () => {
    expect(
      isStaleDeviceConnectIdAliasRecord({
        candidate: { ...staleCandidate, connectId: 'OTHER_SERIAL' },
        keepDbDeviceId,
        verifiedDeviceId,
        aliases,
      }),
    ).toBe(false);
  });

  it('requires a verified identity and at least one alias', () => {
    expect(
      isStaleDeviceConnectIdAliasRecord({
        candidate: staleCandidate,
        keepDbDeviceId,
        verifiedDeviceId: '',
        aliases,
      }),
    ).toBe(false);
    expect(
      isStaleDeviceConnectIdAliasRecord({
        candidate: staleCandidate,
        keepDbDeviceId,
        verifiedDeviceId,
        aliases: [],
      }),
    ).toBe(false);
  });
});
