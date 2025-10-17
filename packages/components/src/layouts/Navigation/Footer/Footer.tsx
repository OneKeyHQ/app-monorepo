import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge } from '@onekeyhq/components/src/content/Badge';
import { useNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import { SizableText, View, XStack } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { FooterLink } from './components/FooterLink';
import { FooterNavigation } from './components/FooterNavigation';

const LINKS = [
  {
    id: 'about',
    label: '关于',
    href: 'https://help.onekey.so/articles/11461135',
  },
  {
    id: 'docs',
    label: '文档',
    href: 'https://help.onekey.so/collections/15988402',
  },
  {
    id: 'guide',
    label: '新手教程',
    href: 'https://help.onekey.so/articles/12568192',
  },
  {
    id: 'terms',
    label: '使用条款',
    href: 'https://help.onekey.so/articles/11461292',
  },
  {
    id: 'privacy',
    label: '隐私',
    href: 'https://help.onekey.so/articles/11461298',
  },
];

export function Footer() {
  const intl = useIntl();
  const { isInternetReachable } = useNetInfo();

  const status = useMemo(() => {
    if (isInternetReachable === false) {
      return {
        badgeType: 'critical' as const,
        dotColor: '$bgCriticalPressed',
        text: intl.formatMessage({
          id: ETranslations.perp_offline,
        }),
      };
    }
    return {
      badgeType: 'success' as const,
      dotColor: '$bgSuccessStrong',
      text: intl.formatMessage({
        id: ETranslations.perp_online,
      }),
    };
  }, [intl, isInternetReachable]);

  const linkItems = useMemo(
    () =>
      LINKS.map((item) => (
        <FooterLink key={item.id} label={item.label} href={item.href} />
      )),
    [],
  );

  return (
    <XStack
      width="100%"
      px="$2"
      py="$2"
      borderTopWidth={1}
      borderTopColor="$borderSubdued"
      bg="$bgApp"
      gap="$2"
      alignItems="center"
      justifyContent="space-between"
    >
      <Badge
        badgeSize="sm"
        badgeType={status.badgeType}
        px="$2"
        py="$px"
        gap="$1.5"
        ai="center"
      >
        <View width={8} height={8} borderRadius="$full" bg={status.dotColor} />
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {status.text}
        </SizableText>
      </Badge>
      <FooterNavigation>{linkItems}</FooterNavigation>
    </XStack>
  );
}
