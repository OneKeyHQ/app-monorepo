/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';

import type { IFirmwareUpdateDevSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import PageFirmwareUpdatePro2DevSettings from '../Setting/pages/FirmwareUpdateDevSettings/PageFirmwareUpdatePro2DevSettings';

import { FirmwareChangeLogContentView } from './components/FirmwareChangeLogView';
import { useFirmwareUpdateItems } from './componentsV2/useFirmwareUpdateItems';

let mockDeveloperMode = true;
let mockVerifyVersions:
  | {
      finalFirmwareVersion: string;
      finalBootloaderVersion: string;
      finalBleVersion: string;
    }
  | undefined;
let mockFirmwareSettings: Partial<IFirmwareUpdateDevSettings>;
const mockUpdateFirmwareSettings = jest.fn(
  async (values: Partial<IFirmwareUpdateDevSettings>) => {
    mockFirmwareSettings = { ...mockFirmwareSettings, ...values };
  },
);

jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});

jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1, create: (styles: unknown) => styles },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Div = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', undefined, children);
  const Button = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    React.createElement(
      'button',
      { type: 'button', onClick: onPress, 'data-testid': testID },
      children,
    );

  return {
    Accordion: Object.assign(Div, {
      Item: Div,
      Content: Div,
      HeightAnimator: Div,
      Trigger: ({
        children,
      }: {
        children: (state: { open: boolean }) => ReactNode;
      }) => React.createElement('div', undefined, children({ open: true })),
    }),
    Anchor: Div,
    Button,
    Divider: Div,
    ESwitchSize: { small: 'small' },
    Icon: () => null,
    Markdown: Div,
    Page: Object.assign(Div, { Header: () => null }),
    Progress: ({ value }: { value: number }) =>
      React.createElement('div', {
        role: 'progressbar',
        'aria-valuenow': value,
      }),
    SizableText: ({
      children,
      color,
    }: {
      children?: ReactNode;
      color?: string;
    }) => React.createElement('div', { 'data-color': color }, children),
    Stack: Div,
    Switch: ({
      value,
      onChange,
      testID,
    }: {
      value: boolean;
      onChange: (enabled: boolean) => void;
      testID: string;
    }) =>
      React.createElement('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': value,
        'data-testid': testID,
        onClick: () => onChange(!value),
      }),
    XStack: Div,
    YStack: Div,
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ title, children }: { title: string; children?: ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  ),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      updateFirmwareUpdateDevSettings: (
        values: Partial<IFirmwareUpdateDevSettings>,
      ) => mockUpdateFirmwareSettings(values),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const step = { step: 'idle' };
  const setStep = jest.fn();
  return {
    EFirmwareUpdateSteps: {},
    useDevSettingsPersistAtom: () => [{ enabled: mockDeveloperMode }],
    useFirmwareUpdateDevSettingsPersistAtom: () => [mockFirmwareSettings],
    useFirmwareUpdateResultVerifyAtom: () => [mockVerifyVersions],
    useFirmwareUpdateStepInfoAtom: () => [step, setStep],
    useHardwareUiStateAtom: () => [undefined],
    useHardwareUiStateCompletedAtom: () => [undefined],
    useSettingsPersistAtom: () => [{ locale: 'en-US' }],
  };
});
jest.mock(
  '../Setting/pages/Tab/DevSettingsSection/FirmwareUpdateActions',
  () => ({
    FirmwareUpdateActions: () => null,
  }),
);
jest.mock('./components/FirmwareUpdatePageLayout', () => ({
  FirmwareUpdatePageFooter: () => null,
}));
jest.mock('./components/FirmwareUpdateIntroduction', () => ({
  FirmwareUpdateIntroduction: () => null,
}));
jest.mock('./components/FirmwareUpdatePromptWebUsbDevice', () => ({
  FirmwareUpdatePromptWebUsbDevice: () => null,
}));
jest.mock('./hooks/useFirmwareUpdateActions', () => ({
  useFirmwareUpdateActions: () => ({}),
}));
jest.mock('./hooks/useFirmwareVersionValid', () => ({
  useFirmwareVersionValid: () => ({
    versionValid: (value: string) => !!value,
    unknownMessage: 'Unknown',
  }),
}));

const release = {
  deviceType: 'pro2',
  updateInfos: {
    firmware: {
      hasUpgrade: true,
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      changelog: { 'en-US': 'SafeOS release notes' },
    },
  },
  pro2TargetsToUpdate: ['boot', 'resource'],
  pro2ResourceArchive: { archiveSha256: '1234567890abcdef', archiveSize: 1024 },
  protocolV2FirmwareVersionInfo: {
    safeOS: { currentVersion: '1.0.0', targetVersion: '1.1.0' },
    components: [
      { target: 'boot', currentVersion: '0.1.0', targetVersion: '0.2.0' },
    ],
  },
} as ICheckAllFirmwareReleaseResult;

describe('Pro2 firmware debug information visibility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockDeveloperMode = true;
    mockVerifyVersions = undefined;
    mockFirmwareSettings = { pro2ForceUpdateTargets: ['boot'] };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('defaults off for existing settings and changes only the visibility preference', async () => {
    const { rerender } = render(<PageFirmwareUpdatePro2DevSettings />);
    const toggle = screen.getByTestId('pro2-firmware-hide-debug-info');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    await act(async () => {
      fireEvent.click(toggle);
    });
    rerender(<PageFirmwareUpdatePro2DevSettings />);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(mockUpdateFirmwareSettings).toHaveBeenLastCalledWith({
      hidePro2FirmwareDebugInfo: true,
    });
    expect(mockFirmwareSettings.pro2ForceUpdateTargets).toEqual(['boot']);

    await act(async () => {
      fireEvent.click(toggle);
    });
    rerender(<PageFirmwareUpdatePro2DevSettings />);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(mockUpdateFirmwareSettings).toHaveBeenLastCalledWith({
      hidePro2FirmwareDebugInfo: false,
    });
  });

  it('hides and restores changelog component details without hiding SafeOS or release notes', () => {
    const { rerender } = render(
      <FirmwareChangeLogContentView result={release} />,
    );
    expect(screen.getByText('0.2.0')).toBeTruthy();
    expect(screen.getByText('SHA-256 1234567890ab')).toBeTruthy();

    mockFirmwareSettings.hidePro2FirmwareDebugInfo = true;
    rerender(<FirmwareChangeLogContentView result={release} />);
    expect(screen.queryByText('0.2.0')).toBeNull();
    expect(screen.queryByText('SHA-256 1234567890ab')).toBeNull();
    expect(screen.getByText('SafeOS')).toBeTruthy();
    expect(screen.getByText('SafeOS release notes')).toBeTruthy();

    mockFirmwareSettings.hidePro2FirmwareDebugInfo = false;
    rerender(<FirmwareChangeLogContentView result={release} />);
    expect(screen.getByText('0.2.0')).toBeTruthy();
  });

  it('lists SafeOS only for Pro 2 outside developer mode', () => {
    mockDeveloperMode = false;
    mockFirmwareSettings.hidePro2FirmwareDebugInfo = true;
    const { result } = renderHook(() => useFirmwareUpdateItems(release));
    expect(result.current.items.map((item) => item.key)).toEqual(['safeos']);
    expect(result.current.hideDebugInfo).toBe(false);
  });

  it('adds component rows in developer mode and hides them on request', () => {
    const { result, rerender } = renderHook(() =>
      useFirmwareUpdateItems(release),
    );
    expect(result.current.items.map((item) => item.key)).toEqual([
      'safeos',
      'boot',
      'resource',
    ]);

    mockFirmwareSettings.hidePro2FirmwareDebugInfo = true;
    rerender();
    expect(result.current.items.map((item) => item.key)).toEqual(['safeos']);
    expect(result.current.hideDebugInfo).toBe(true);
  });

  it.each([EDeviceType.Neo])(
    'does not hide another device (%s) component rows',
    (deviceType) => {
      mockFirmwareSettings.hidePro2FirmwareDebugInfo = true;
      const { result } = renderHook(() =>
        useFirmwareUpdateItems({ ...release, deviceType }),
      );
      expect(result.current.items.map((item) => item.key)).toEqual([
        'safeos',
        'boot',
        'resource',
      ]);
      expect(result.current.hideDebugInfo).toBe(false);
    },
  );
});
