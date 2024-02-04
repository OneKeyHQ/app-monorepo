import { useEffect, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IIconProps } from '@onekeyhq/components';
import { Icon, Image, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

function DAppSiteMark({
  origin,
  urlSecurityInfo,
}: {
  origin: string;
  urlSecurityInfo?: IHostSecurity;
}) {
  const content = useMemo(() => origin, [origin]);
  const [faviconUri, setFaviconUri] = useState<string>('');
  useEffect(() => {
    backgroundApiProxy.serviceDiscovery
      .getWebsiteIcon(origin)
      .then((uri) => {
        setFaviconUri(uri);
      })
      .catch(() => {
        // ignore
      });
  }, [origin]);

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
          iconName: 'InfoSquareSolid',
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
      p="$1"
      bg={riskyStyle.bg}
      borderColor={riskyStyle.borderColor}
      borderWidth={StyleSheet.hairlineWidth}
      borderRadius="$2"
      alignItems="center"
      alignSelf="flex-start"
      style={{
        borderCurve: 'continuous',
      }}
    >
      <Image w="$6" h="$6" bg="$bgSubdued" borderRadius="$1">
        <Image.Source source={{ uri: faviconUri }} />
        <Image.Fallback>
          <Icon size="$6" name="GlobusOutline" color="$iconSubdued" />
        </Image.Fallback>
      </Image>
      <SizableText size="$bodyLgMedium" color={riskyStyle.textColor} px="$1">
        {content}
      </SizableText>
      {riskyStyle.iconName && riskyStyle.iconColor ? (
        <Icon
          name={riskyStyle.iconName}
          color={riskyStyle.iconColor}
          size="$5"
        />
      ) : null}
    </XStack>
  );
}

export { DAppSiteMark };
