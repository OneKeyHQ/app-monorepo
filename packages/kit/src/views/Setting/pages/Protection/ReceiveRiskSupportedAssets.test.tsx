/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { RECEIVE_RISK_MONITORING_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalWebViewRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useOpenReceiveRiskMonitoringHelp } from './ReceiveRiskSupportedAssets';

const mockPushModal = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlInApp: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSetting: {
      getKytSupportedAssets: jest.fn(async () => []),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatar: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock(
  '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
jest.mock('../Tab/settingsSurface', () => ({
  SETTINGS_PAGE_BODY_INSET_X: 0,
}));

describe('useOpenReceiveRiskMonitoringHelp', () => {
  beforeEach(() => {
    mockPushModal.mockClear();
    (openUrlInApp as jest.Mock).mockClear();
  });

  it('pushes the help WebView above the current supported-assets surface', () => {
    const { result } = renderHook(() => useOpenReceiveRiskMonitoringHelp());

    act(() => {
      result.current();
    });

    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.WebViewModal, {
      screen: EModalWebViewRoutes.WebView,
      params: {
        url: RECEIVE_RISK_MONITORING_HELP_LINK,
        title: ETranslations.prime_feature_receive_risk_monitoring__title,
      },
    });
    expect(openUrlInApp).not.toHaveBeenCalled();
  });
});
