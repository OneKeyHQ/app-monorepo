import { useCallback, useEffect, useMemo, useState } from 'react';

import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import type {
  IAlertType,
  IKeyOfIcons,
  IStackProps,
} from '@onekeyhq/components';
import {
  Accordion,
  Alert,
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { Markdown } from '@onekeyhq/components/src/content/Markdown';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IBleFirmwareUpdateInfo,
  IBootloaderUpdateInfo,
  ICheckAllFirmwareReleaseResult,
  IFirmwareChangeLog,
  IFirmwareUpdateInfo,
  IPro2FirmwareUpdateTarget,
} from '@onekeyhq/shared/types/device';

import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';
import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';
import { FirmwareUpdateTestIDs } from '../testIDs';

import { FirmwareUpdateIntroduction } from './FirmwareUpdateIntroduction';
import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';
import { FirmwareVersionProgressText } from './FirmwareVersionProgressBar';

type IProtocolV2FirmwareComponentDisplay = {
  target?: string;
  version?: number[];
  url?: string;
  resourceManifest?: {
    packages?: Array<{
      name?: string;
      path?: string;
      version?: number[];
    }>;
  };
};

const PRO2_FORCE_TARGET_BY_COMPONENT_TARGET = new Map<
  string,
  IPro2FirmwareUpdateTarget
>([
  ['BOOTLOADER', 'boot'],
  ['APPLICATION_P1', 'app_v1'],
  ['APPLICATION_P2', 'app_v2'],
  ['CRATE', 'resource'],
  ['SE01', 'se01'],
  ['SE02', 'se02'],
  ['SE03', 'se03'],
  ['SE04', 'se04'],
]);

function formatVersion(version: string | number[] | undefined) {
  if (Array.isArray(version)) {
    return version.join('.');
  }
  return version ?? '';
}

function isPro2SafeOSFirmwareUpdate(
  result: ICheckAllFirmwareReleaseResult | undefined,
) {
  return (
    result?.deviceType === EDeviceType.Pro2 &&
    result?.updateInfos?.firmware?.hasUpgrade === true
  );
}

function FirmwareVersionOnlyProgressText({
  fromVersion = '',
  toVersion = '',
  active,
}: {
  fromVersion?: string;
  toVersion?: string;
  active: boolean;
}) {
  const { versionValid, unknownMessage } = useFirmwareVersionValid();
  const textColor = active ? '$text' : '$textSubdued';
  const versionTextProps = {
    size: '$bodyLgMedium',
    minWidth: 0,
    flexShrink: 1,
    numberOfLines: 1,
  } as const;
  const fromVersionText = versionValid(fromVersion)
    ? fromVersion
    : unknownMessage;
  const toVersionText = toVersion?.length > 0 ? toVersion : unknownMessage;

  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      minWidth={0}
      flexShrink={1}
      flexWrap="wrap"
    >
      <SizableText {...versionTextProps} color={textColor}>
        {fromVersionText}
      </SizableText>
      <Icon name="ArrowRightSolid" size="$4" color={textColor} flexShrink={0} />
      <SizableText {...versionTextProps} color={textColor}>
        {toVersionText}
      </SizableText>
    </XStack>
  );
}

function ChangeLogMarkdown({
  changelog,
}: {
  changelog: IFirmwareChangeLog | undefined;
}) {
  const [{ locale }] = useSettingsPersistAtom();
  const [language, setLanguage] = useState(locale);

  useEffect(() => {
    void (async () => {
      if (locale === 'system') {
        setLanguage(await backgroundApiProxy.serviceSetting.getCurrentLocale());
      }
    })();
  }, [locale]);

  return (
    <Markdown>
      {changelog?.[language === 'zh-CN' ? 'zh-CN' : 'en-US'] ||
        'No change log found.'}
    </Markdown>
  );
}

function ChangeLogSection({
  title,
  updateInfo,
  accordionValue,
  versionOnly,
}: {
  title: string;
  accordionValue: string;
  versionOnly?: boolean;
  updateInfo:
    | IFirmwareUpdateInfo
    | IBleFirmwareUpdateInfo
    | IBootloaderUpdateInfo
    | undefined;
}) {
  return (
    <Accordion.Item value={accordionValue}>
      <Accordion.Trigger
        unstyled
        borderWidth={0}
        flexDirection="row"
        alignItems="center"
        px="$0"
        py="$3"
        mx="$5"
        bg="$transparent"
        // borderTopWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: -2,
        }}
      >
        {({ open }: { open: boolean }) => (
          <>
            <XStack
              ai="center"
              gap="$1.5"
              flex={1}
              minWidth={0}
              flexShrink={1}
              flexWrap="wrap"
            >
              <SizableText
                size="$bodyLgMedium"
                color={open ? '$text' : '$textSubdued'}
                flexShrink={0}
              >
                {title}
              </SizableText>
              {versionOnly ? (
                <FirmwareVersionOnlyProgressText
                  fromVersion={updateInfo?.fromVersion}
                  toVersion={updateInfo?.toVersion}
                  active={open}
                />
              ) : (
                <FirmwareVersionProgressText
                  fromVersion={updateInfo?.fromVersion}
                  fromFirmwareType={updateInfo?.fromFirmwareType}
                  toVersion={updateInfo?.toVersion}
                  toFirmwareType={updateInfo?.toFirmwareType}
                  githubReleaseUrl={updateInfo?.githubReleaseUrl}
                  active={open}
                />
              )}
            </XStack>
            <Stack
              animation="quick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
              rotate={open ? '-180deg' : '0deg'}
              flexShrink={0}
            >
              <Icon
                name="ChevronDownSmallOutline"
                size="$6"
                color={open ? '$icon' : '$iconSubdued'}
              />
            </Stack>
          </>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          animation="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          exitStyle={{ opacity: 0 }}
          px="$5"
          pb="$5"
          pt="$0"
        >
          <Stack mt="$-2.5">
            <ChangeLogMarkdown changelog={updateInfo?.changelog} />
          </Stack>
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

function FirmwareUpdateDebugPayloadSection({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const release = result?.updateInfos?.firmware?.releasePayload?.release;
  const components = release?.components as
    | Record<string, IProtocolV2FirmwareComponentDisplay>
    | undefined;
  const pro2ForceTargets = result?.pro2ForceTargets;

  const componentEntries = useMemo(() => {
    if (!components) return [];
    const forceTargets = new Set(pro2ForceTargets ?? []);
    const orderedKeys = [
      ...(release?.installOrder ?? []),
      ...Object.keys(components).filter(
        (key) => !release?.installOrder?.includes(key),
      ),
    ];
    return orderedKeys
      .map((key) => [key, components[key]] as const)
      .filter(([, component]) => {
        if (!component) return false;
        if (forceTargets.size === 0) return true;
        const target = component.target?.toUpperCase();
        const pro2ForceTarget = target
          ? PRO2_FORCE_TARGET_BY_COMPONENT_TARGET.get(target)
          : undefined;
        return Boolean(pro2ForceTarget && forceTargets.has(pro2ForceTarget));
      });
  }, [components, pro2ForceTargets, release?.installOrder]);

  if (componentEntries.length === 0) {
    return null;
  }

  return (
    <Stack
      mx="$5"
      mt="$2"
      mb="$3"
      py="$3"
      borderTopWidth={1}
      borderColor="$borderSubdued"
    >
      <SizableText size="$bodyMdMedium" color="$textSubdued" mb="$2">
        Debug update payload
      </SizableText>
      <Stack gap="$2">
        {componentEntries.map(([key, component]) => {
          const packageNames = component.resourceManifest?.packages
            ?.map((pkg) => pkg.name || pkg.path)
            .filter(Boolean)
            .join(', ');
          const version = formatVersion(component.version);
          return (
            <XStack key={key} gap="$2" alignItems="center" minWidth={0}>
              <SizableText size="$bodyMd" color="$text" flex={1} minWidth={0}>
                {key}
              </SizableText>
              {packageNames ? (
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  flex={1}
                  minWidth={0}
                  numberOfLines={1}
                >
                  {packageNames}
                </SizableText>
              ) : null}
              <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
                {[component.target, version].filter(Boolean).join(' / ')}
              </SizableText>
            </XStack>
          );
        })}
      </Stack>
    </Stack>
  );
}

export function FirmwareChangeLogContentView({
  result,
  ...rest
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
} & IStackProps) {
  const intl = useIntl();
  const defaultExpandedSections = useMemo(() => {
    if (result?.updateInfos?.firmware?.hasUpgrade) return 'firmware';
    if (result?.updateInfos?.bootloader?.hasUpgrade) return 'bootloader';
    if (result?.updateInfos?.ble?.hasUpgrade) return 'ble';
    return undefined;
  }, [result?.updateInfos]);
  const isPro2SafeOSUpdate = isPro2SafeOSFirmwareUpdate(result);

  return (
    <Stack {...rest}>
      <Accordion
        overflow="hidden"
        width="100%"
        type="single"
        defaultValue={defaultExpandedSections}
        collapsible
      >
        {result?.updateInfos?.firmware?.hasUpgrade ? (
          <ChangeLogSection
            title={
              isPro2SafeOSUpdate
                ? 'SafeOS'
                : intl.formatMessage({ id: ETranslations.global_firmware })
            }
            updateInfo={result?.updateInfos?.firmware}
            accordionValue="firmware"
            versionOnly={isPro2SafeOSUpdate}
          />
        ) : null}
        {result?.updateInfos?.bootloader?.hasUpgrade && !isPro2SafeOSUpdate ? (
          <ChangeLogSection
            title={intl.formatMessage({ id: ETranslations.global_bootloader })}
            updateInfo={result?.updateInfos?.bootloader}
            accordionValue="bootloader"
          />
        ) : null}
        {result?.updateInfos?.ble?.hasUpgrade && !isPro2SafeOSUpdate ? (
          <ChangeLogSection
            title={intl.formatMessage({ id: ETranslations.global_bluetooth })}
            updateInfo={result?.updateInfos?.ble}
            accordionValue="ble"
          />
        ) : null}
      </Accordion>
      {isPro2SafeOSUpdate ? (
        <FirmwareUpdateDebugPayloadSection result={result} />
      ) : null}
    </Stack>
  );
}

export function FirmwareChangeLogChangeFirmwareWarnView({
  content,
  type,
}: {
  content: string;
  type?: IAlertType;
}) {
  let icon: IKeyOfIcons | undefined;
  if (type === 'info') {
    icon = 'InfoCircleOutline';
  } else if (type === 'warning') {
    icon = 'InfoCircleOutline';
  } else if (type === 'danger') {
    icon = 'ErrorOutline';
  }

  return (
    <Alert
      mx="$5"
      my="$2.5"
      type={type}
      title={content}
      icon={icon}
      closable={false}
    />
  );
}

export function FirmwareChangeFirmwareWarn({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();

  if (!result?.updateInfos?.firmware) return null;
  const firmwareInfo = result?.updateInfos?.firmware;
  if (
    firmwareInfo.fromFirmwareType === undefined ||
    firmwareInfo.toFirmwareType === undefined ||
    firmwareInfo.fromFirmwareType === firmwareInfo.toFirmwareType
  )
    return null;

  const tips: { content: string; type?: IAlertType }[] = [];

  if (firmwareInfo?.toFirmwareType === EFirmwareType.BitcoinOnly) {
    tips.push({
      content: intl.formatMessage({
        id: ETranslations.device_change_to_btc_only_banner,
      }),
      type: 'info',
    });
  }

  tips.push({
    content: intl.formatMessage({
      // oxlint-disable-next-line @cspell/spellchecker
      id: ETranslations.device_wipe_data_bannner,
    }),
    type: 'danger',
  });
  tips.push({
    content: intl.formatMessage({
      id: ETranslations.device_recover_data_banner,
    }),
    type: 'danger',
  });

  return (
    <>
      {tips.map((item, index) => (
        <FirmwareChangeLogChangeFirmwareWarnView
          key={`${index}`}
          content={item.content}
          type={item.type}
        />
      ))}
    </>
  );
}

export function FirmwareChangeLogView({
  result,
  onConfirmClick,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  onConfirmClick?: () => void;
}) {
  const intl = useIntl();
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const { showCheckList } = useFirmwareUpdateActions();

  const handleConfirmClick = useCallback(async () => {
    const isUSBDeviceAvailable =
      await backgroundApiProxy.serviceHardware.detectUSBDeviceAvailability();
    if (!isUSBDeviceAvailable) {
      Dialog.show({
        icon: 'TypeCoutline',
        title: intl.formatMessage({
          id: ETranslations.upgrade_use_usb,
        }),
        description: intl.formatMessage({
          id: ETranslations.upgrade_recommend_usb,
        }),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_got_it,
        }),
        showCancelButton: false,
      });
      return;
    }
    setStepInfo({
      step: EFirmwareUpdateSteps.showCheckList,
      payload: undefined,
    });
    const updateFirmwareInfo = result?.updateInfos?.firmware;
    if (
      updateFirmwareInfo?.fromFirmwareType !== undefined &&
      updateFirmwareInfo?.toFirmwareType !== undefined &&
      updateFirmwareInfo.fromFirmwareType !== updateFirmwareInfo.toFirmwareType
    ) {
      defaultLogger.update.firmware.firmwareSwitchStart({
        deviceType: result?.deviceType,
        fromFirmwareType: updateFirmwareInfo.fromFirmwareType,
        toFirmwareType: updateFirmwareInfo.toFirmwareType,
      });
    }
    showCheckList({ result });
    onConfirmClick?.();
  }, [result, showCheckList, onConfirmClick, setStepInfo, intl]);

  const updateFirmwareInfo = result?.updateInfos?.firmware;

  const showUpdateIntroduction =
    updateFirmwareInfo?.fromFirmwareType !== undefined &&
    updateFirmwareInfo?.toFirmwareType !== undefined &&
    updateFirmwareInfo?.fromFirmwareType !== updateFirmwareInfo?.toFirmwareType;

  return (
    <>
      <FirmwareUpdatePageFooter
        onConfirmText={intl.formatMessage({
          id: ETranslations.update_update_now,
        })}
        onConfirm={handleConfirmClick}
        confirmButtonProps={{
          testID: FirmwareUpdateTestIDs.updateNowBtn,
        }}
      />
      {showUpdateIntroduction ? <FirmwareUpdateIntroduction /> : null}
      <FirmwareChangeFirmwareWarn result={result} />
      <FirmwareChangeLogContentView result={result} />
    </>
  );
}
