/**
 * @jest-environment jsdom
 */

import type { ComponentProps, PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';

import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import DownloadVerify from './DownloadVerify';

let mockStatus = EAppUpdateStatus.downloadPackage;
const mockDownloadPackage = jest.fn();
const mockDownloadASC = jest.fn();

jest.mock('@react-navigation/core', () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: PropsWithChildren) => children;
  const Empty = () => null;
  return {
    Alert: ({ title }: { title: string }) => <div role="alert">{title}</div>,
    Button: Empty,
    EStepItemStatus: {},
    Page: Object.assign(Container, {
      Header: Empty,
      Body: Container,
      Footer: Empty,
    }),
    SizableText: Container,
    Stepper: Object.assign(Container, { Item: Empty }),
    XStack: Container,
  };
});

jest.mock('../../../components/AppUpdate', () => ({
  useAppUpdateInfo: () => ({ data: { status: mockStatus } }),
  useDownloadPackage: () => ({
    downloadPackage: mockDownloadPackage,
    downloadASC: mockDownloadASC,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      getSkipBundleGPGVerification: () => Promise.resolve(false),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  useDownloadProgress: () => 0,
}));

jest.mock('@onekeyhq/shared/src/appUpdate', () => ({
  getAppUpdateProgressScope: () => undefined,
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update/error', () => ({
  EUpdateErrorCode: { installLocation: 'INSTALL_LOCATION' },
}));

jest.mock('../hooks/useForceUpdateContactSupport', () => ({
  useForceUpdateContactSupport: () => ({ isForceUpdate: false }),
}));

jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => ({
  showIntercom: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('../../../components/HyperlinkText', () => ({
  HyperlinkText: () => null,
}));

const pageProps = {
  route: { params: {} },
} as ComponentProps<typeof DownloadVerify>;
const offlineMessage = ETranslations.update_network_exception_check_connection;

function setOnline(online: boolean) {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
  globalThis.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = EAppUpdateStatus.downloadPackage;
  setOnline(true);
});

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'onLine');
});

test.each([
  EAppUpdateStatus.downloadPackage,
  EAppUpdateStatus.downloadASC,
  EAppUpdateStatus.downloadPackageFailed,
  EAppUpdateStatus.downloadASCFailed,
])('shows the offline warning on entry during %s', async (status) => {
  mockStatus = status;
  setOnline(false);
  await act(async () => {
    render(<DownloadVerify {...pageProps} />);
  });

  expect(screen.getByRole('alert').textContent).toBe(offlineMessage);
});

test('reacts to disconnect and reconnect before the download reports a result', async () => {
  await act(async () => {
    render(<DownloadVerify {...pageProps} />);
  });
  expect(screen.queryByRole('alert')).toBeNull();

  act(() => setOnline(false));
  expect(screen.getByRole('alert').textContent).toBe(offlineMessage);

  act(() => setOnline(true));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(mockDownloadPackage).not.toHaveBeenCalled();
  expect(mockDownloadASC).not.toHaveBeenCalled();
});

test.each([
  EAppUpdateStatus.verifyASC,
  EAppUpdateStatus.verifyPackage,
  EAppUpdateStatus.verifyASCFailed,
  EAppUpdateStatus.verifyPackageFailed,
  EAppUpdateStatus.ready,
])(
  'does not show a network warning for local verification or installation: %s',
  async (status) => {
    mockStatus = status;
    setOnline(false);
    await act(async () => {
      render(<DownloadVerify {...pageProps} />);
    });

    expect(screen.queryByRole('alert')).toBeNull();
  },
);

test('clears the warning when the download completes while offline', async () => {
  setOnline(false);
  const view = render(<DownloadVerify {...pageProps} />);
  expect(screen.getByRole('alert').textContent).toBe(offlineMessage);

  mockStatus = EAppUpdateStatus.ready;
  await act(async () => {
    view.rerender(<DownloadVerify {...pageProps} />);
  });
  expect(screen.queryByRole('alert')).toBeNull();
});
