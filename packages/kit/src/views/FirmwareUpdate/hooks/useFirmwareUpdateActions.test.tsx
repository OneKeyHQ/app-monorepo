/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { resetModalRouteByName } from '@onekeyhq/components';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';

import { useFirmwareUpdateActions } from './useFirmwareUpdateActions';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('use-debounce', () => ({
  useThrottledCallback: (callback: unknown) => callback,
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    confirm: jest.fn(),
    show: jest.fn(),
  },
  resetModalRouteByName: jest.fn(),
  resetToRoute: jest.fn(),
  rootNavigationRef: { current: null },
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    push: jest.fn(),
    pushModal: jest.fn(),
  }),
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      openExtensionExpandTab: jest.fn(),
    },
  },
}));

jest.mock('../components/FirmwareUpdateCheckList', () => ({
  FirmwareUpdateCheckList: () => null,
}));

jest.mock('./bootloaderModeDialogManager', () => ({
  bootloaderModeDialogManager: {
    show: jest.fn(),
  },
}));

describe('useFirmwareUpdateActions', () => {
  it('closes the whole firmware update modal', () => {
    const { result } = renderHook(() => useFirmwareUpdateActions());

    act(() => {
      result.current.closeUpdateModal();
    });

    expect(resetModalRouteByName).toHaveBeenCalledWith(
      EModalRoutes.FirmwareUpdateModal,
    );
  });
});
