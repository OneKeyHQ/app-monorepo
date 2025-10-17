import { useMemo } from 'react';

import { NetworkStatusBadge } from '@onekeyhq/components/src/content/NetworkStatusBadge';
import { useNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import { XStack } from '@onekeyhq/components/src/primitives';

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
  const { isInternetReachable } = useNetInfo();

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
      <NetworkStatusBadge
        connected={isInternetReachable !== false}
        badgeSize="sm"
        labelFontSize={13}
      />
      <FooterNavigation>{linkItems}</FooterNavigation>
    </XStack>
  );
}
