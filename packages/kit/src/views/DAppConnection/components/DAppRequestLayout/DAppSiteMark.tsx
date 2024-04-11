import { memo, useMemo } from 'react';

import { StyleSheet } from 'react-native';

import type { IIconProps } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

function RawDappSiteIcon({ uri }: { uri?: string }) {
  return uri ? (
    <Image w="$6" h="$6" bg="$bgSubdued" borderRadius="$1">
      <Image.Source source={{ uri }} />
      <Image.Fallback>
        <Icon size="$6" name="GlobusOutline" color="$iconSubdued" />
      </Image.Fallback>
      <Image.Loading>
        <Skeleton width="100%" height="100%" />
      </Image.Loading>
    </Image>
  ) : null;
}
const DappSiteIcon = memo(RawDappSiteIcon);

function DAppSiteMark({
  origin,
  urlSecurityInfo,
  favicon,
}: {
  origin: string;
  urlSecurityInfo?: IHostSecurity;
  favicon?: string; // for WalletConnect
}) {
  const content = useMemo(() => {
    try {
      return new URL(origin).host;
    } catch {
      return origin;
    }
  }, [origin]);
  const { result: faviconUri } = usePromiseResult(
    async () => backgroundApiProxy.serviceDiscovery.buildWebsiteIconUrl(origin),
    [origin],
  );
  const riskyStyle = useMemo<{
    bg: string;
    borderColor: string;
    textColor: string;
    iconName: IIconProps['name'] | null;
    iconColor: IIconProps['color'] | null;
  }>(() => {
    const defaultStyle = {
      bg: '$bgSubdued',
      borderColor: '$borderSubdued',
      textColor: '$textSubdued',
      iconName: null,
      iconColor: null,
    };
    if (!urlSecurityInfo?.level) {
      return defaultStyle;
    }
    switch (urlSecurityInfo?.level) {
      case EHostSecurityLevel.Security: {
        return {
          bg: '$bgSubdued',
          borderColor: '$border',
          textColor: '$text',
          iconName: 'BadgeVerifiedSolid',
          iconColor: '$iconSuccess',
        };
      }
      case EHostSecurityLevel.High: {
        return {
          bg: '$bgCriticalSubdued',
          borderColor: '$borderCritical',
          textColor: '$textCritical',
          iconName: 'ErrorSolid',
          iconColor: '$iconCritical',
        };
      }
      case EHostSecurityLevel.Medium: {
        return {
          bg: '$bgCautionSubdued',
          borderColor: '$borderCaution',
          textColor: '$textCaution',
          iconName: 'ErrorSolid',
          iconColor: '$iconCaution',
        };
      }
      default: {
        return defaultStyle;
      }
    }
  }, [urlSecurityInfo?.level]);
  return (
    <XStack
      px="$2"
      py="$1"
      bg={riskyStyle.bg}
      borderColor={riskyStyle.borderColor}
      borderWidth={StyleSheet.hairlineWidth}
      borderRadius="$2"
      alignItems="center"
      alignSelf="flex-start"
      borderCurve="continuous"
      space="$2"
    >
      <DappSiteIcon uri={favicon || faviconUri} />
      <SizableText
        flex={1}
        size="$bodyLgMedium"
        color={riskyStyle.textColor}
        style={{
          wordBreak: 'break-all',
        }}
      >
        {content}
      </SizableText>
      {riskyStyle.iconName && riskyStyle.iconColor ? (
        <Icon
          pt="$0.5"
          name={riskyStyle.iconName}
          color={riskyStyle.iconColor}
          size="$5"
        />
      ) : null}
    </XStack>
  );
}

export { DAppSiteMark };
