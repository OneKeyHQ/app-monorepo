import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  Dialog,
  Divider,
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import { DAppRequestedDappList } from '../../../DAppConnection/components/DAppRequestContent/DAppRequestedDappList';
import { DAppRiskyAlertDetail } from '../../../DAppConnection/components/DAppRequestLayout/DAppRiskyAlertDetail';

const SecurityTitleMap = {
  [EHostSecurityLevel.Security]: ETranslations.dapp_connect_verified_site,
  [EHostSecurityLevel.High]: ETranslations.dapp_connect_malicious_site_warning,
  [EHostSecurityLevel.Medium]:
    ETranslations.dapp_connect_suspected_malicious_behavior,
};

export function DappInfoPopoverContent({
  hostSecurity,
  closePopover,
  iconConfig,
}: {
  hostSecurity?: IHostSecurity;
  closePopover: () => void;
  iconConfig: {
    iconName: IKeyOfIcons;
    iconColor: IIconProps['color'];
  };
}) {
  const intl = useIntl();
  const { securityElement, securityStatus } = useMemo(() => {
    if (hostSecurity?.level === EHostSecurityLevel.Unknown) {
      return {
        securityStatus: EHostSecurityLevel.Unknown,
        securityElement: (
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.browser_risk_detection_unknown,
            })}
          </SizableText>
        ),
      };
    }

    const providerNames =
      hostSecurity?.checkSources
        .filter((item) => item.riskLevel === hostSecurity?.level)
        .map((item) => item.name)
        .join(' & ') || '';
    return {
      securityStatus: hostSecurity?.level
        ? SecurityTitleMap[hostSecurity?.level]
        : EHostSecurityLevel.Unknown,
      securityElement: (
        <>
          <SizableText size="$bodyMd" flex={1}>
            {intl.formatMessage({
              id: hostSecurity?.level
                ? SecurityTitleMap[hostSecurity?.level]
                : ETranslations.browser_risk_detection_unknown,
            })}
          </SizableText>
          {providerNames ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.global_from_provider,
                },
                {
                  provider: providerNames,
                },
              )}
            </SizableText>
          ) : null}
        </>
      ),
    };
  }, [hostSecurity?.checkSources, hostSecurity?.level, intl]);
  return (
    <YStack
      gap="$5"
      p="$5"
      onPress={(e) => {
        e.stopPropagation();
      }}
    >
      {/* basic info */}
      <XStack alignItems="center" userSelect="none" gap="$3">
        {/* logomark */}
        <Image
          size="$10"
          borderRadius="$2"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderCurve="continuous"
          source={{
            uri: hostSecurity?.dapp?.logo,
          }}
          fallback={
            <Image.Fallback>
              <Icon name="GlobusOutline" size="$10" />
            </Image.Fallback>
          }
        />
        {/* title, badge and description */}
        <Stack flex={1} gap="$0.5">
          <XStack alignItems="center" gap="$2">
            <SizableText size="$headingMd" flexShrink={1} numberOfLines={1}>
              {hostSecurity?.dapp?.name ?? hostSecurity?.host}
            </SizableText>
            {hostSecurity?.dapp?.tags.length ? (
              <Badge
                badgeSize="sm"
                badgeType={hostSecurity?.dapp?.tags[0]?.type}
              >
                {hostSecurity?.dapp?.tags[0]?.name.text}
              </Badge>
            ) : null}
          </XStack>
          {/* <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {hostSecurity?.dapp?.description.text ?? ''}
          </SizableText> */}
        </Stack>
      </XStack>
      <Divider />
      {/* risk detection */}
      <YStack gap="$2">
        <SizableText size="$headingSm">
          {intl.formatMessage({
            id: ETranslations.browser_risk_detection,
          })}
        </SizableText>
        <XStack
          ai="center"
          px="$2"
          py="$2"
          borderRadius="$2"
          borderCurve="continuous"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          bg="$bgSubdued"
          userSelect="none"
          {...(securityStatus === EHostSecurityLevel.Unknown
            ? null
            : {
                onPress: () => {
                  closePopover();
                  Dialog.show({
                    title: hostSecurity?.host,
                    renderContent: (
                      <DAppRiskyAlertDetail urlSecurityInfo={hostSecurity} />
                    ),
                    showFooter: false,
                  });
                },
                hoverStyle: {
                  bg: '$bgHover',
                },
                pressStyle: {
                  bg: '$bgActive',
                },
                focusable: true,
                focusVisibleStyle: {
                  outlineWidth: 2,
                  outlineColor: '$focusRing',
                  outlineStyle: 'solid',
                  outlineOffset: 2,
                },
              })}
        >
          <Icon
            name={iconConfig.iconName}
            color={iconConfig.iconColor}
            size="$5"
          />
          <YStack pl="$3" flex={1}>
            {securityElement}
          </YStack>
          {securityStatus === EHostSecurityLevel.Unknown ? null : (
            <Icon
              name="ChevronRightSmallOutline"
              color="$iconSubdued"
              size="$5"
            />
          )}
        </XStack>
      </YStack>
      <DAppRequestedDappList
        origins={hostSecurity?.dapp?.origins}
        updatedAt={hostSecurity?.updatedAt}
      />
    </YStack>
  );
}
