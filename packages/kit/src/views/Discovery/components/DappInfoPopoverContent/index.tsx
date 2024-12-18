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
    const security =
      hostSecurity?.checkSources
        .filter((item) => item.riskLevel === EHostSecurityLevel.Security)
        .map((item) => item.name)
        .join(' & ') || '';
    if (security) {
      return {
        securityStatus: EHostSecurityLevel.Security,
        securityElement: (
          <>
            <SizableText size="$bodyMd" flex={1}>
              {intl.formatMessage({
                id: ETranslations.dapp_connect_verified_site,
              })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.global_from_provider,
                },
                {
                  provider: security,
                },
              )}
            </SizableText>
          </>
        ),
      };
    }

    const highSecurity =
      hostSecurity?.checkSources
        .filter((item) => item.riskLevel === EHostSecurityLevel.High)
        .map((item) => item.name)
        .join(' & ') || '';

    if (highSecurity) {
      return {
        securityStatus: EHostSecurityLevel.High,
        securityElement: (
          <>
            <SizableText size="$bodyMd" flex={1}>
              {intl.formatMessage({
                id: ETranslations.dapp_connect_malicious_site_warning,
              })}
            </SizableText>
            <SizableText size="$bodyMd">
              {intl.formatMessage(
                {
                  id: ETranslations.global_from_provider,
                },
                {
                  provider: highSecurity,
                },
              )}
            </SizableText>
          </>
        ),
      };
    }

    const mediumSecurity =
      hostSecurity?.checkSources
        .filter((item) => EHostSecurityLevel.Medium === item.riskLevel)
        .map((item) => item.name)
        .join(' & ') || '';

    if (mediumSecurity) {
      return {
        securityStatus: EHostSecurityLevel.Medium,
        securityElement: (
          <>
            <SizableText size="$bodyMd" flex={1}>
              {intl.formatMessage({
                id: ETranslations.dapp_connect_suspected_malicious_behavior,
              })}
            </SizableText>
            <SizableText size="$bodyMd">
              {intl.formatMessage(
                {
                  id: ETranslations.global_from_provider,
                },
                {
                  provider: mediumSecurity,
                },
              )}
            </SizableText>
          </>
        ),
      };
    }

    return {
      securityStatus: EHostSecurityLevel.Unknown,
      securityElement: (
        <SizableText size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.global_unknown,
          })}
        </SizableText>
      ),
    };
  }, [hostSecurity?.checkSources, intl]);
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
          w="$10"
          h="$10"
          borderRadius="$2"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderCurve="continuous"
        >
          {hostSecurity?.dapp?.logo ? (
            <Image.Source
              source={{
                uri: hostSecurity?.dapp?.logo,
              }}
            />
          ) : null}
          <Image.Fallback
            alignItems="center"
            justifyContent="center"
            bg="$bgSubdued"
          >
            <Icon name="GlobusOutline" width="$6" height="$6" />
          </Image.Fallback>
          {hostSecurity?.dapp?.logo ? (
            <Image.Loading>
              <Skeleton width="100%" height="100%" />
            </Image.Loading>
          ) : null}
        </Image>
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
          <XStack pl="$3" flex={1}>
            {securityElement}
          </XStack>
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
