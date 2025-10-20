import { Anchor } from '@onekeyhq/components';

export interface IFooterLinkProps {
  label: string;
  href: string;
}

export function FooterLink({ label, href }: IFooterLinkProps) {
  return (
    <Anchor
      href={href}
      target="_blank"
      size="$bodyMd"
      color="$textSubdued"
      textDecorationLine="none"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      px="$2"
      py="$1"
      mx="$-1"
      my="$-1"
      borderRadius="$2"
    >
      {label}
    </Anchor>
  );
}
