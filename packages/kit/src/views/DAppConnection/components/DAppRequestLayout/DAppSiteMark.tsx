import { useEffect, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IIconProps } from '@onekeyhq/components';
import { Icon, Image, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import type { IRiskLevel } from '../../types';

function DAppSiteMark({
  origin,
  riskLevel,
}: {
  origin: string;
  riskLevel: IRiskLevel;
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
    iconName: IIconProps['name'];
    iconColor: IIconProps['color'];
  }>(() => {
    switch (riskLevel) {
      case 'Verified': {
        return {
          bg: '$bgSubdued',
          borderColor: '$border',
          textColor: '$text',
          iconName: 'BadgeVerifiedSolid',
          iconColor: '$iconSuccess',
        };
      }
      case 'Scam': {
        return {
          bg: '$bgCriticalSubdued',
          borderColor: '$borderCritical',
          textColor: '$textCritical',
          iconName: 'ErrorSolid',
          iconColor: '$iconCritical',
        };
      }
      default: {
        return {
          bg: '$bgCautionSubdued',
          borderColor: '$borderCaution',
          textColor: '$textCaution',
          iconName: 'InfoSquareSolid',
          iconColor: '$iconCaution',
        };
      }
    }
  }, [riskLevel]);

  return (
    <XStack
      p="$1"
      bg={riskyStyle.bg}
      borderColor={riskyStyle.borderColor}
      borderWidth={StyleSheet.hairlineWidth}
      borderRadius="$2"
      alignItems="center"
      alignSelf="flex-start"
    >
      <Image w="$6" h="$6" bg="$bgSubdued" borderRadius="$1">
        <Image.Source source={{ uri: faviconUri }} />
        <Image.Fallback>
          <Icon size="$6" name="GlobusOutline" color="$iconSubdued" />
        </Image.Fallback>
      </Image>
      <SizableText
        p="$1"
        size="$bodyLgMedium"
        color={riskyStyle.textColor}
        textAlign="center"
      >
        {content}
      </SizableText>
      <Icon name={riskyStyle.iconName} color={riskyStyle.iconColor} size="$5" />
    </XStack>
  );
}

export { DAppSiteMark };
