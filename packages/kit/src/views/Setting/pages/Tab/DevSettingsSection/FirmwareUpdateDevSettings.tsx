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
import type {
  IFirmwareUpdateDevSettingsKeys,
  IPro2FirmwareUpdateTarget,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HARDWARE_CONFIG_URL_LOCAL,
  HARDWARE_CONFIG_URL_PRO2_DEDICATED,
} from '@onekeyhq/shared/src/hardware/configUrls';

import { FirmwareUpdateActions } from './FirmwareUpdateActions';

const PRO2_FIRMWARE_UPDATE_TARGETS: {
  value: IPro2FirmwareUpdateTarget;
  label: string;
}[] = [
  { value: 'boot', label: 'boot' },
  { value: 'app_v1', label: 'app_v1' },
  { value: 'app_v2', label: 'app_v2' },
  { value: 'resource', label: 'resource' },
  { value: 'se01', label: 'se01' },
  { value: 'se02', label: 'se02' },
  { value: 'se03', label: 'se03' },
  { value: 'se04', label: 'se04' },
];

const EMPTY_PRO2_FIRMWARE_UPDATE_TARGETS: IPro2FirmwareUpdateTarget[] = [];

const PRO2_APP_AND_SE_TARGETS = new Set<IPro2FirmwareUpdateTarget>([
  'app_v1',
  'app_v2',
  'se01',
  'se02',
  'se03',
  'se04',
]);

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
        <Button
          size="small"
          disabled={currentUrl === HARDWARE_CONFIG_URL_PRO2_DEDICATED}
          onPress={() =>
            updateHardwareConfigUrl(HARDWARE_CONFIG_URL_PRO2_DEDICATED)
          }
        >
          Pro2
        </Button>
      </XStack>
    </ListItem>
  );
}

function buildPro2LegacyForceValues({
  targets,
  onceTargets,
}: {
  targets: IPro2FirmwareUpdateTarget[];
  onceTargets: IPro2FirmwareUpdateTarget[];
}) {
  const hasPersistentFirmwareTarget = targets.some((target) =>
    PRO2_APP_AND_SE_TARGETS.has(target),
  );
  const hasOnceFirmwareTarget = onceTargets.some((target) =>
    PRO2_APP_AND_SE_TARGETS.has(target),
  );
  return {
    forceUpdateFirmware: hasPersistentFirmwareTarget,
    forceUpdateOnceFirmware: hasOnceFirmwareTarget,
    forceUpdateBootloader: targets.includes('boot'),
    forceUpdateOnceBootloader: onceTargets.includes('boot'),
    forceUpdateResource: targets.includes('resource'),
    forceUpdateResEvenSameVersion: targets.includes('resource'),
  };
}

function Pro2FirmwareUpdateTargetRow({
  target,
}: {
  target: (typeof PRO2_FIRMWARE_UPDATE_TARGETS)[number];
}) {
  const [devSetting, setDevSetting] = useFirmwareUpdateDevSettingsPersistAtom();
  const targets =
    devSetting.pro2ForceUpdateTargets ?? EMPTY_PRO2_FIRMWARE_UPDATE_TARGETS;
  const onceTargets =
    devSetting.pro2ForceUpdateOnceTargets ?? EMPTY_PRO2_FIRMWARE_UPDATE_TARGETS;

  const updateTargets = useCallback(
    async ({
      nextTargets,
      nextOnceTargets,
    }: {
      nextTargets: IPro2FirmwareUpdateTarget[];
      nextOnceTargets: IPro2FirmwareUpdateTarget[];
    }) => {
      const values = {
        pro2ForceUpdateTargets: nextTargets,
        pro2ForceUpdateOnceTargets: nextOnceTargets,
        ...buildPro2LegacyForceValues({
          targets: nextTargets,
          onceTargets: nextOnceTargets,
        }),
      };
      setDevSetting((prev) => ({
        ...prev,
        ...values,
      }));
      await backgroundApiProxy.serviceDevSetting.updateFirmwareUpdateDevSettings(
        values,
      );
    },
    [setDevSetting],
  );

  const setTargetEnabled = useCallback(
    async (enabled: boolean) => {
      const nextTargets = enabled
        ? Array.from(new Set([...targets, target.value]))
        : targets.filter((item) => item !== target.value);
      await updateTargets({
        nextTargets,
        nextOnceTargets: onceTargets,
      });
    },
    [onceTargets, target.value, targets, updateTargets],
  );

  const setOnceTargetEnabled = useCallback(
    async (enabled: boolean) => {
      const nextOnceTargets = enabled
        ? Array.from(new Set([...onceTargets, target.value]))
        : onceTargets.filter((item) => item !== target.value);
      await updateTargets({
        nextTargets: targets,
        nextOnceTargets,
      });
    },
    [onceTargets, target.value, targets, updateTargets],
  );

  return (
    <ListItem title={target.label} titleProps={{ color: '$textCritical' }}>
      <XStack gap="$4" alignItems="center">
        <YStack alignItems="center" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            force
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={targets.includes(target.value)}
            onChange={setTargetEnabled}
          />
        </YStack>
        <YStack alignItems="center" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            once
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={onceTargets.includes(target.value)}
            onChange={setOnceTargetEnabled}
          />
        </YStack>
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

export function FirmwareUpdatePro2DevSettings() {
  const [devSetting, setDevSetting] = useFirmwareUpdateDevSettingsPersistAtom();

  const resetPro2ForceTargets = useCallback(async () => {
    const values = {
      pro2ForceUpdateTargets: [],
      pro2ForceUpdateOnceTargets: [],
      forceUpdateFirmware: false,
      forceUpdateOnceFirmware: false,
      forceUpdateBootloader: false,
      forceUpdateOnceBootloader: false,
      forceUpdateResource: false,
      forceUpdateResEvenSameVersion: false,
    };
    setDevSetting((prev) => ({
      ...prev,
      ...values,
    }));
    await backgroundApiProxy.serviceDevSetting.updateFirmwareUpdateDevSettings(
      values,
    );
  }, [setDevSetting]);

  return (
    <YStack>
      <HardwareConfigUrlDevButtons />
      <ListItem
        title="Pro2 force targets"
        subtitle="boot / app_v1 / app_v2 / resource / se01-se04"
        titleProps={{ color: '$textCritical' }}
      />
      {PRO2_FIRMWARE_UPDATE_TARGETS.map((target) => (
        <Pro2FirmwareUpdateTargetRow key={target.value} target={target} />
      ))}
      <ListItem
        title="Force relation"
        subtitle="boot maps to bootloader; app_v1/app_v2/se01-se04 map to firmware; resource maps to resource only."
        titleProps={{ color: '$textCritical' }}
      />
      <XStack px="$5" py="$3" gap="$2">
        <Button size="small" onPress={resetPro2ForceTargets}>
          Reset Pro2 force targets
        </Button>
      </XStack>
      <SizableText>{JSON.stringify(devSetting, null, 2)}</SizableText>
      <FirmwareUpdateActions />
    </YStack>
  );
}
