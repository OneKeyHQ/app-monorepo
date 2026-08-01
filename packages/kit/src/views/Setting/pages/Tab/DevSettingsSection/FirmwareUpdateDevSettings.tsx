import type { PropsWithChildren, ReactElement } from 'react';
import { Children, cloneElement, useCallback } from 'react';

import type { IPropsWithTestId } from '@onekeyhq/components';
import {
  Button,
  ESwitchSize,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useFirmwareUpdateDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IFirmwareUpdateDevSettingsKeys } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { HARDWARE_CONFIG_URL_LOCAL } from '@onekeyhq/shared/src/hardware/configUrls';

import { FirmwareUpdateActions } from './FirmwareUpdateActions';

interface IFirmwareUpdateSectionFieldItem extends PropsWithChildren {
  name?: IFirmwareUpdateDevSettingsKeys;
  title: IListItemProps['title'];
  titleProps?: IListItemProps['titleProps'];
  onValueChange?: (v: any) => Promise<void> | void;
}

function FirmwareUpdateSectionFieldItem({
  name,
  title,
  titleProps = { color: '$textCritical' },
  children,
  onValueChange,
  testID = '',
}: IPropsWithTestId<IFirmwareUpdateSectionFieldItem>) {
  const [devSetting, setDevSetting] = useFirmwareUpdateDevSettingsPersistAtom();
  const child = Children.only(children) as ReactElement;
  const value = name ? devSetting?.[name] : '';
  const handleChange = useCallback(
    async (v: any) => {
      if (name) {
        setDevSetting((o) => ({ ...o, [name]: v }));
        await onValueChange?.(v);
      }
    },
    [name, onValueChange, setDevSetting],
  );
  const field = child
    ? cloneElement(child, {
        ...(child.props as any),
        value,
        onChange: handleChange,
      })
    : null;
  return (
    <ListItem title={title} titleProps={titleProps} testID={testID}>
      {field}
    </ListItem>
  );
}

function HardwareConfigUrlDevButtons() {
  const [devSetting, setDevSetting] = useFirmwareUpdateDevSettingsPersistAtom();
  const updateHardwareConfigUrl = useCallback(
    async (hardwareConfigUrl: string) => {
      setDevSetting((o) => ({
        ...o,
        hardwareConfigUrl,
        usePreReleaseConfig: false,
      }));
      await backgroundApiProxy.serviceDevSetting.updateFirmwareUpdateDevSettings(
        { hardwareConfigUrl, usePreReleaseConfig: false },
      );
      await backgroundApiProxy.serviceHardware.resetHardwareSDK();
    },
    [setDevSetting],
  );
  const currentUrl = devSetting.hardwareConfigUrl;

  return (
    <ListItem
      title="Hardware config source"
      titleProps={{ color: '$textCritical' }}
    >
      <XStack gap="$2">
        <Button
          size="small"
          disabled={currentUrl === HARDWARE_CONFIG_URL_LOCAL}
          onPress={() => updateHardwareConfigUrl(HARDWARE_CONFIG_URL_LOCAL)}
        >
          Localhost
        </Button>
      </XStack>
    </ListItem>
  );
}

export function FirmwareUpdateDevSettings() {
  const [devSetting, setDevSetting] = useFirmwareUpdateDevSettingsPersistAtom();
  const handlePreReleaseConfigChange = useCallback(
    async (usePreReleaseConfig: boolean) => {
      const values = usePreReleaseConfig
        ? { usePreReleaseConfig, hardwareConfigUrl: '' }
        : { usePreReleaseConfig };
      if (usePreReleaseConfig) {
        setDevSetting((o) => ({ ...o, hardwareConfigUrl: '' }));
      }
      await backgroundApiProxy.serviceDevSetting.updateFirmwareUpdateDevSettings(
        values,
      );
      await backgroundApiProxy.serviceHardware.resetHardwareSDK();
    },
    [setDevSetting],
  );

  return (
    <YStack>
      <FirmwareUpdateSectionFieldItem
        name="lowBatteryLevel"
        title="Low Battery"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="shouldUpdateBridge"
        title="Should Update Bridge"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="shouldUpdateFullRes"
        title="Should Update Full Resources"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="shouldUpdateFromWeb"
        title="Should Update from web"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateBtcOnlyUniversalFirmware"
        title="BTC only 强制提示升级到最新通用固件"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="allIsUpToDate"
        title="All is up to date"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="usePreReleaseConfig"
        title="Use pre-release config"
        onValueChange={handlePreReleaseConfigChange}
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <HardwareConfigUrlDevButtons />
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateResource"
        title="Force update resource"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateResEvenSameVersion"
        title="Force update res even same version"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateFirmware"
        title="Force update firmware"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateOnceFirmware"
        title="Force update firmware (once)"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="updateDevDeviceBootloaderOnAppAllowed"
        title="允许在 App 中更新 dev 设备的 bootloader"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateBle"
        title="Force update bluetooth"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateOnceBle"
        title="Force update bluetooth (once)"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateBootloader"
        title="Force update bootloader"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="forceUpdateOnceBootloader"
        title="Force update bootloader (once)"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="showAutoCheckHardwareUpdatesToast"
        title="Show Auto Check Hardware Updates Toast"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="showDeviceDebugLogs"
        title="Show Device Debug Log"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <SizableText>{JSON.stringify(devSetting, null, 2)}</SizableText>
      <FirmwareUpdateActions />
    </YStack>
  );
}
