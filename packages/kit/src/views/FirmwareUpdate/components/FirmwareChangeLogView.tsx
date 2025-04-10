import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Divider,
  Icon,
  Markdown,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IBleFirmwareUpdateInfo,
  IBootloaderUpdateInfo,
  ICheckAllFirmwareReleaseResult,
  IFirmwareChangeLog,
  IFirmwareUpdateInfo,
} from '@onekeyhq/shared/types/device';

import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

import { FirmwareUpdateIntroduction } from './FirmwareUpdateIntroduction';
import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';
import { FirmwareVersionProgressText } from './FirmwareVersionProgressBar';

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
}: {
  title: string;
  accordionValue: string;
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
        alignItems="center"
        alignSelf="stretch"
        flexDirection="row"
        justifyContent="space-between"
        px="$5"
        py="$0"
        borderRadius="$1"
        borderWidth={0}
        bg="$transparent"
        hoverStyle={{
          bg: '$bgSubdued',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: 0,
        }}
      >
        {({ open }: { open: boolean }) => (
          <Stack w="100%">
            <Divider />
            <XStack py="$3" ai="center" jc="space-between" w="100%">
              <XStack ai="center" gap="$1.5">
                <SizableText
                  size="$bodyLgMedium"
                  color={open ? '$text' : '$textSubdued'}
                >
                  {title}
                </SizableText>
                <FirmwareVersionProgressText
                  fromVersion={updateInfo?.fromVersion}
                  toVersion={updateInfo?.toVersion}
                  githubReleaseUrl={updateInfo?.githubReleaseUrl}
                  active={open}
                />
              </XStack>
              <Icon
                name={
                  open ? 'ChevronDownSmallOutline' : 'ChevronTopSmallOutline'
                }
                size="$6"
                color={open ? '$icon' : '$iconSubdued'}
              />
            </XStack>
          </Stack>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          animation="quick"
          exitStyle={{ opacity: 0 }}
          px="$5"
          pb="$5"
          pt="$0"
        >
          <ChangeLogMarkdown changelog={updateInfo?.changelog} />
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

export function FirmwareChangeLogContentView({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  const defaultExpandedSections = useMemo(() => {
    const sections: string[] = [];
    if (result?.updateInfos?.firmware?.hasUpgrade) sections.push('firmware');
    if (result?.updateInfos?.bootloader?.hasUpgrade)
      sections.push('bootloader');
    if (result?.updateInfos?.ble?.hasUpgrade) sections.push('ble');
    return sections;
  }, [result?.updateInfos]);

  return (
    <Stack>
      <Accordion
        overflow="hidden"
        width="100%"
        type="multiple"
        defaultValue={defaultExpandedSections}
      >
        {result?.updateInfos?.firmware?.hasUpgrade ? (
          <ChangeLogSection
            title={intl.formatMessage({ id: ETranslations.global_firmware })}
            updateInfo={result?.updateInfos?.firmware}
            accordionValue="firmware"
          />
        ) : null}
        {result?.updateInfos?.bootloader?.hasUpgrade ? (
          <ChangeLogSection
            title={intl.formatMessage({ id: ETranslations.global_bootloader })}
            updateInfo={result?.updateInfos?.bootloader}
            accordionValue="bootloader"
          />
        ) : null}
        {result?.updateInfos?.ble?.hasUpgrade ? (
          <ChangeLogSection
            title={intl.formatMessage({ id: ETranslations.global_bluetooth })}
            updateInfo={result?.updateInfos?.ble}
            accordionValue="ble"
          />
        ) : null}
      </Accordion>
    </Stack>
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

  return (
    <>
      <FirmwareUpdatePageFooter
        onConfirmText={intl.formatMessage({
          id: ETranslations.update_update_now,
        })}
        onConfirm={() => {
          setStepInfo({
            step: EFirmwareUpdateSteps.showCheckList,
            payload: undefined,
          });
          showCheckList({ result });
          onConfirmClick?.();
        }}
      />
      <FirmwareUpdateIntroduction />
      <FirmwareChangeLogContentView result={result} />
    </>
  );
}
