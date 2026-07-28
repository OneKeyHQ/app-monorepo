import { getInstallReferrerAsync } from 'expo-application';

import appStorage from '../../storage/appStorage';

import {
  parseGooglePlayInstallReferrer,
  reportGooglePlayInstallAttribution,
} from './googlePlay';

jest.mock('expo-application', () => ({
  getInstallReferrerAsync: jest.fn(),
}));

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      install: {
        googlePlayInstallAttribution: jest.fn(),
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
const getReportedMock = jest.mocked(appStorage.getItem);
const markReportedMock = jest.mocked(appStorage.setItem);
const mockedLoggerModule = jest.requireMock('../../logger/logger') as {
  defaultLogger: {
    app: {
      install: {
        googlePlayInstallAttribution: jest.Mock;
      };
    };
  };
};
const logAttributionMock =
  mockedLoggerModule.defaultLogger.app.install.googlePlayInstallAttribution;

describe('Google Play install attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getReportedMock.mockResolvedValue(null);
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

  it('logs the attribution and marks it as reported', async () => {
    getInstallReferrerMock.mockResolvedValue(
      'utm_source=onekey.so&utm_medium=owned_web&utm_campaign=download_page&click_id=click-123',
    );

    await reportGooglePlayInstallAttribution();

    expect(logAttributionMock).toHaveBeenCalledWith({
      clickId: 'click-123',
      utmCampaign: 'download_page',
      utmMedium: 'owned_web',
      utmSource: 'onekey.so',
    });
    expect(markReportedMock).toHaveBeenCalledWith(
      'google_play_install_attribution_reported_v1',
      '1',
    );
  });

  it('skips attribution already reported', async () => {
    getReportedMock.mockResolvedValue('1');

    await reportGooglePlayInstallAttribution();

    expect(getInstallReferrerMock).not.toHaveBeenCalled();
    expect(logAttributionMock).not.toHaveBeenCalled();
  });
});
