import { memo, useMemo } from 'react';

import type { IIconProps } from '@onekeyhq/components';
import { Icon, Image, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

import { DAppConnectionTestIDs } from '../../testIDs';

function shouldHideDAppSiteRiskStyle(urlSecurityInfo?: IHostSecurity) {
  return (
    urlSecurityInfo?.level === EHostSecurityLevel.High ||
    urlSecurityInfo?.level === EHostSecurityLevel.Medium
  );
}

function DAppSiteMarkInner({
  origin,
  urlSecurityInfo,
  favicon,
  hideRiskStyle,
}: {
  origin: string;
  urlSecurityInfo?: IHostSecurity;
  favicon?: string; // for WalletConnect
  hideRiskStyle?: boolean;
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
    textColor: string;
    iconName: IIconProps['name'] | null;
    iconColor: IIconProps['color'] | null;
  }>(() => {
    const defaultStyle = {
      textColor: '$textSubdued',
      iconName: null,
      iconColor: null,
    };
    if (hideRiskStyle || !urlSecurityInfo?.level) {
      return defaultStyle;
    }
    switch (urlSecurityInfo?.level) {
      case EHostSecurityLevel.Security: {
        return {
          textColor: '$text',
          iconName: 'BadgeVerifiedSolid',
          iconColor: '$iconSuccess',
        };
      }
      case EHostSecurityLevel.High: {
        return {
          textColor: '$textCritical',
          iconName: 'ErrorSolid',
          iconColor: '$iconCritical',
        };
      }
      case EHostSecurityLevel.Medium: {
        return {
          textColor: '$textCaution',
          iconName: 'ErrorSolid',
          iconColor: '$iconCaution',
        };
      }
      default: {
        return defaultStyle;
      }
    }
  }, [hideRiskStyle, urlSecurityInfo?.level]);

  return (
    <XStack
      testID={DAppConnectionTestIDs.SiteMark}
      alignItems="center"
      alignSelf="flex-start"
      gap="$1.5"
    >
      <Image
        size="$5"
        bg="$bgSubdued"
        borderRadius={6}
        borderCurve="continuous"
        source={{ uri: favicon || faviconUri }}
        fallback={
          <Image.Fallback>
            <Icon size="$5" name="GlobusOutline" color="$iconSubdued" />
          </Image.Fallback>
        }
      />
      <SizableText
        size="$bodyMd"
        color={riskyStyle.textColor}
        style={{
          wordBreak: 'break-all',
        }}
      >
        {content}
      </SizableText>
      {riskyStyle.iconName && riskyStyle.iconColor ? (
        <Icon
          name={riskyStyle.iconName}
          color={riskyStyle.iconColor}
          size="$4.5"
        />
      ) : null}
    </XStack>
  );
}

const DAppSiteMark = memo(DAppSiteMarkInner);

export { DAppSiteMark, shouldHideDAppSiteRiskStyle };
