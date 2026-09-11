import {
  getInstallReferrerAsync,
  getInstallationTimeAsync,
} from 'expo-application';

import appStorage from '../../storage/appStorage';

import {
  parseGooglePlayInstallReferrer,
  reportGooglePlayInstallAttribution,
} from './googlePlay';

jest.mock('expo-application', () => ({
  getInstallationTimeAsync: jest.fn(),
  getInstallReferrerAsync: jest.fn(),
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
const getReportedMock = jest.mocked(appStorage.getItem);
const markReportedMock = jest.mocked(appStorage.setItem);
const mockedLoggerModule = jest.requireMock('../../logger/logger');
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
