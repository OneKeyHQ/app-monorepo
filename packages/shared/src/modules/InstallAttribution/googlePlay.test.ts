import {
  getInstallReferrerAsync,
  getInstallationTimeAsync,
  getLastUpdateTimeAsync,
} from 'expo-application';

import appStorage from '../../storage/appStorage';

import {
  extractInviteCodeFromInstallReferrer,
  parseGooglePlayInstallReferrer,
  readGooglePlayInviteCodeAttribution,
  reportGooglePlayInstallAttribution,
} from './googlePlay';

jest.mock('expo-application', () => ({
  getInstallationTimeAsync: jest.fn(),
  getInstallReferrerAsync: jest.fn(),
  getLastUpdateTimeAsync: jest.fn(),
}));

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      install: {
        reportGooglePlayInstallAttribution: jest.fn(),
      },
    },
  },
}));

jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const getInstallReferrerMock = jest.mocked(getInstallReferrerAsync);
const getInstallationTimeMock = jest.mocked(getInstallationTimeAsync);
const getLastUpdateTimeMock = jest.mocked(getLastUpdateTimeAsync);
const getReportedMock = jest.mocked(appStorage.getItem);
const markReportedMock = jest.mocked(appStorage.setItem);
const mockedLoggerModule = jest.requireMock('../../logger/logger') as {
  defaultLogger: {
    app: {
      install: {
        reportGooglePlayInstallAttribution: jest.Mock;
      };
    };
  };
};
const logAttributionMock =
  mockedLoggerModule.defaultLogger.app.install
    .reportGooglePlayInstallAttribution;

describe('Google Play install attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstallationTimeMock.mockResolvedValue(new Date());
    getReportedMock.mockResolvedValue(null);
    logAttributionMock.mockResolvedValue(undefined);
    markReportedMock.mockResolvedValue(undefined);
  });

  it('parses only allowlisted and bounded referrer fields', () => {
    expect(
      parseGooglePlayInstallReferrer(
        `utm_source=onekey.so&utm_campaign=${'a'.repeat(
          256,
        )}&click_id=click-123&wallet_address=secret`,
      ),
    ).toEqual({
      clickId: 'click-123',
      utmCampaign: 'a'.repeat(128),
      utmSource: 'onekey.so',
    });
  });

  it('decodes a referrer encoded one extra time', () => {
    expect(
      parseGooglePlayInstallReferrer(
        'utm_source%3Donekey.so%26utm_medium%3Downed_web',
      ),
    ).toEqual({
      utmMedium: 'owned_web',
      utmSource: 'onekey.so',
    });
  });

  it('ignores empty and not-set referrer values without relying on brackets', () => {
    expect(
      parseGooglePlayInstallReferrer(
        'utm_source=&utm_medium=(not%20set)&utm_campaign=NOT%20SET&utm_content=google_play_button',
      ),
    ).toEqual({
      utmContent: 'google_play_button',
    });
  });

  it('logs the attribution and marks it as reported', async () => {
    const rawReferrer =
      'utm_source=onekey.so&utm_medium=owned_web&utm_campaign=download_page&click_id=click-123';
    getInstallReferrerMock.mockResolvedValue(rawReferrer);

    await reportGooglePlayInstallAttribution();

    expect(logAttributionMock).toHaveBeenCalledWith({
      clickId: 'click-123',
      utmCampaign: 'download_page',
      utmMedium: 'owned_web',
      utmSource: 'onekey.so',
    });
    expect(markReportedMock).toHaveBeenCalledWith('install_attr_v1', '1');
  });

  it('does not mark attribution as reported when delivery fails', async () => {
    getInstallReferrerMock.mockResolvedValue(
      'utm_source=onekey.so&utm_medium=owned_web',
    );
    logAttributionMock.mockRejectedValueOnce(new Error('network failed'));

    await expect(reportGooglePlayInstallAttribution()).rejects.toThrow(
      'network failed',
    );

    expect(markReportedMock).not.toHaveBeenCalled();

    await reportGooglePlayInstallAttribution();

    expect(getInstallReferrerMock).toHaveBeenCalledTimes(2);
    expect(logAttributionMock).toHaveBeenCalledTimes(2);
    expect(markReportedMock).toHaveBeenCalledWith('install_attr_v1', '1');
  });

  it('does not report an empty raw referrer', async () => {
    getInstallReferrerMock.mockResolvedValue('');

    await reportGooglePlayInstallAttribution();

    expect(logAttributionMock).not.toHaveBeenCalled();
    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it('does not report a non-empty referrer without supported fields', async () => {
    getInstallReferrerMock.mockResolvedValue('campaign_source=unsupported');

    await reportGooglePlayInstallAttribution();

    expect(logAttributionMock).not.toHaveBeenCalled();
    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it('does not report attribution without a valid utm source', async () => {
    const rawReferrer =
      'utm_source=(not%20set)&utm_medium=(not%20set)&utm_campaign=download_page';
    getInstallReferrerMock.mockResolvedValue(rawReferrer);

    await reportGooglePlayInstallAttribution();

    expect(logAttributionMock).not.toHaveBeenCalled();
    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it('marks an existing installation as handled without reading referrer', async () => {
    getInstallationTimeMock.mockResolvedValue(
      new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    );

    await reportGooglePlayInstallAttribution();

    expect(getInstallReferrerMock).not.toHaveBeenCalled();
    expect(logAttributionMock).not.toHaveBeenCalled();
    expect(markReportedMock).toHaveBeenCalledWith('install_attr_v1', '1');
  });

  it('skips attribution already reported', async () => {
    getReportedMock.mockResolvedValue('1');

    await reportGooglePlayInstallAttribution();

    expect(getInstallationTimeMock).not.toHaveBeenCalled();
    expect(getInstallReferrerMock).not.toHaveBeenCalled();
    expect(logAttributionMock).not.toHaveBeenCalled();
  });
});

describe('extractInviteCodeFromInstallReferrer', () => {
  it('reads ref_code alongside utm params', () => {
    expect(
      extractInviteCodeFromInstallReferrer(
        'utm_source=referral&utm_medium=invite&utm_campaign=refer_a_friend&ref_code=ABC123',
      ),
    ).toBe('ABC123');
  });

  it('reads ref_code from a double-encoded referrer', () => {
    expect(
      extractInviteCodeFromInstallReferrer(
        'utm_source%3Dreferral%26ref_code%3DABC123',
      ),
    ).toBe('ABC123');
  });

  it('returns undefined for an organic install', () => {
    expect(
      extractInviteCodeFromInstallReferrer(
        'utm_source=google-play&utm_medium=organic',
      ),
    ).toBeUndefined();
  });

  it('returns undefined when Google Ads auto-tagging replaced the referrer', () => {
    expect(
      extractInviteCodeFromInstallReferrer(
        'gclid=EAIaIQobChMI&utm_source=google-ads',
      ),
    ).toBeUndefined();
  });

  it('rejects a malformed code rather than passing it through', () => {
    expect(
      extractInviteCodeFromInstallReferrer('ref_code=abc-123'),
    ).toBeUndefined();
    expect(
      extractInviteCodeFromInstallReferrer(`ref_code=${'a'.repeat(31)}`),
    ).toBeUndefined();
  });

  it('ignores a "not set" placeholder value', () => {
    expect(
      extractInviteCodeFromInstallReferrer('ref_code=not%20set'),
    ).toBeUndefined();
  });

  it('returns undefined for an empty referrer', () => {
    expect(extractInviteCodeFromInstallReferrer('')).toBeUndefined();
  });
});

describe('readGooglePlayInviteCodeAttribution', () => {
  beforeEach(() => {
    // A fresh install: Play reports the same first-install and last-update time.
    getLastUpdateTimeMock.mockImplementation(() => getInstallationTimeMock());
  });

  it('skips an existing install that reached this version through an update', async () => {
    const installedAt = new Date('2026-01-02T03:04:05.000Z');
    getInstallationTimeMock.mockResolvedValue(installedAt);
    getLastUpdateTimeMock.mockResolvedValue(
      new Date('2026-09-20T00:00:00.000Z'),
    );
    getInstallReferrerMock.mockClear();

    await expect(readGooglePlayInviteCodeAttribution()).resolves.toEqual({
      code: undefined,
      installedAt: installedAt.getTime(),
      hasReferrer: false,
      isExistingInstall: true,
    });
    expect(getInstallReferrerMock).not.toHaveBeenCalled();
  });

  it('records a fresh install before asking Play, even when Play then fails', async () => {
    const installedAt = new Date('2026-09-01T00:00:00.000Z');
    getInstallationTimeMock.mockResolvedValue(installedAt);
    getInstallReferrerMock.mockRejectedValueOnce(
      new Error('SERVICE_UNAVAILABLE'),
    );
    const onFreshInstall = jest.fn(async () => {});

    await expect(
      readGooglePlayInviteCodeAttribution(undefined, { onFreshInstall }),
    ).rejects.toThrow('SERVICE_UNAVAILABLE');
    expect(onFreshInstall).toHaveBeenCalledTimes(1);
    expect(onFreshInstall.mock.invocationCallOrder[0]).toBeLessThan(
      getInstallReferrerMock.mock.invocationCallOrder.at(-1) ?? 0,
    );
  });

  it('does not record an existing install as fresh', async () => {
    getInstallationTimeMock.mockResolvedValue(
      new Date('2026-01-02T03:04:05.000Z'),
    );
    getLastUpdateTimeMock.mockResolvedValue(
      new Date('2026-09-20T00:00:00.000Z'),
    );
    const onFreshInstall = jest.fn(async () => {});

    await readGooglePlayInviteCodeAttribution(undefined, { onFreshInstall });
    expect(onFreshInstall).not.toHaveBeenCalled();
  });

  it('keeps retrying a fresh install left pending across a later app update', async () => {
    const installedAt = new Date('2026-09-01T00:00:00.000Z');
    getInstallationTimeMock.mockResolvedValue(installedAt);
    getLastUpdateTimeMock.mockResolvedValue(
      new Date('2026-09-20T00:00:00.000Z'),
    );
    getInstallReferrerMock.mockResolvedValue('ref_code=ABC123');

    await expect(
      readGooglePlayInviteCodeAttribution(undefined, {
        isKnownFreshInstall: true,
      }),
    ).resolves.toEqual({
      code: 'ABC123',
      installedAt: installedAt.getTime(),
      hasReferrer: true,
      isExistingInstall: false,
    });
  });

  it('returns the code and the install timestamp', async () => {
    const installedAt = new Date('2026-01-02T03:04:05.000Z');
    getInstallReferrerMock.mockResolvedValue(
      'utm_source=referral&ref_code=ABC123',
    );
    getInstallationTimeMock.mockResolvedValue(installedAt);

    await expect(readGooglePlayInviteCodeAttribution()).resolves.toEqual({
      code: 'ABC123',
      installedAt: installedAt.getTime(),
      hasReferrer: true,
      isExistingInstall: false,
    });
  });

  it('returns no code for an empty referrer but still reports install time', async () => {
    const installedAt = new Date('2026-01-02T03:04:05.000Z');
    getInstallReferrerMock.mockResolvedValue('');
    getInstallationTimeMock.mockResolvedValue(installedAt);

    await expect(readGooglePlayInviteCodeAttribution()).resolves.toEqual({
      code: undefined,
      installedAt: installedAt.getTime(),
      hasReferrer: false,
      isExistingInstall: false,
    });
  });

  it('is not gated by the analytics one-shot marker', async () => {
    getReportedMock.mockResolvedValue('1');
    getInstallReferrerMock.mockResolvedValue('ref_code=ABC123');
    getInstallationTimeMock.mockResolvedValue(new Date());

    await expect(readGooglePlayInviteCodeAttribution()).resolves.toMatchObject({
      code: 'ABC123',
    });
  });
});
