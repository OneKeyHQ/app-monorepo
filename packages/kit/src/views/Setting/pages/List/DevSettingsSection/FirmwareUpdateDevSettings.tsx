import type { PropsWithChildren, ReactElement } from 'react';
import { Children, cloneElement, useCallback } from 'react';

import type { IPropsWithTestId } from '@onekeyhq/components';
import { ESwitchSize, SizableText, Switch, YStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { FirmwareUpdateGalleryDemo } from '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/FirmwareUpdateGallery';
import { useFirmwareUpdateDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IFirmwareUpdateDevSettingsKeys } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

interface IFirmwareUpdateSectionFieldItem extends PropsWithChildren {
  name?: IFirmwareUpdateDevSettingsKeys;
  title: IListItemProps['title'];
  titleProps?: IListItemProps['titleProps'];
  onValueChange?: (v: any) => void;
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
        onValueChange?.(v);
      }
    },
    [name, onValueChange, setDevSetting],
  );
  const field = child
    ? cloneElement(child, {
        ...child.props,
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

export function FirmwareUpdateDevSettings() {
  const [devSetting] = useFirmwareUpdateDevSettingsPersistAtom();

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
        name="allIsUpToDate"
        title="All is up to date"
      >
        <Switch size={ESwitchSize.small} />
      </FirmwareUpdateSectionFieldItem>
      <FirmwareUpdateSectionFieldItem
        name="usePreReleaseConfig"
        title="Use pre-release config"
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
        name="forceUpdateBle"
        title="Force update bluetooth"
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
      <FirmwareUpdateGalleryDemo />
    </YStack>
  );
}
