import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  Dialog,
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
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.dapp_connect_verified_site,
              })}
            </SizableText>
            <SizableText size="$bodyMd">
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
            <SizableText size="$bodyMdMedium">
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
            <SizableText size="$bodyMdMedium">
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
        <SizableText size="$bodyMdMedium">
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
      <XStack group="card" alignItems="center" userSelect="none">
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
          <Image.Fallback>
            <Icon name="GlobusOutline" width="100%" height="100%" />
          </Image.Fallback>
          {hostSecurity?.dapp?.logo ? (
            <Image.Loading>
              <Skeleton width="100%" height="100%" />
            </Image.Loading>
          ) : null}
        </Image>
        <Stack flex={1} ml="$3">
          <XStack alignItems="center">
            <SizableText
              size="$bodyLgMedium"
              $gtMd={{
                size: '$bodyMdMedium',
              }}
              numberOfLines={1}
            >
              {hostSecurity?.dapp?.name ?? hostSecurity?.host}
            </SizableText>
            {hostSecurity?.dapp?.tags.length ? (
              <Badge
                badgeSize="sm"
                badgeType={hostSecurity?.dapp?.tags[0]?.type}
                ml="$2"
              >
                {hostSecurity?.dapp?.tags[0]?.name.text}
              </Badge>
            ) : null}
          </XStack>
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
            $gtMd={
              {
                size: '$bodySm',
                numberOfLines: 2,
                whiteSpace: 'break-spaces',
              } as any
            }
          >
            {hostSecurity?.dapp?.description.text ?? ''}
          </SizableText>
        </Stack>
      </XStack>
      <YStack gap="$3">
        <SizableText size="$headingMd">
          {intl.formatMessage({
            id: ETranslations.browser_risk_detection,
          })}
        </SizableText>
        <XStack ai="center">
          <Icon name={iconConfig.iconName} color={iconConfig.iconColor} />
          <Stack ml="$3" flex={1}>
            {securityElement}
          </Stack>
          {securityStatus === EHostSecurityLevel.Unknown ? null : (
            <XStack
              ai="center"
              onPress={() => {
                closePopover();
                Dialog.show({
                  title: hostSecurity?.host,
                  renderContent: (
                    <DAppRiskyAlertDetail urlSecurityInfo={hostSecurity} />
                  ),
                  showFooter: false,
                });
              }}
            >
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.global_details,
                })}
              </SizableText>
              <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
            </XStack>
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
