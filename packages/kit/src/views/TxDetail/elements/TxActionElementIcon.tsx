import type { ComponentProps } from 'react';

import { Center, Icon, Token } from '@onekeyhq/components';

import type { ITxActionMeta } from '../types';

export function TxActionElementIcon(
  props: ITxActionMeta & {
    size?: number;
    name?: string;
  },
) {
  const { iconInfo, size = 16, name } = props;
  const sizePx = `${size}px`;
  const containerProps = {
    width: sizePx,
    height: sizePx,
    borderRadius: 'full',
    bg: 'background-selected',
    nativeID: 'TxActionElementIcon-Center-Container',
  };
  const singleIcon = iconInfo?.icon ?? {};
  const defaultIcon = (
    <Token
      showIconBorder
      size={sizePx}
      token={{
        name,
        logoURI: singleIcon.url,
      }}
    />
  );
  if (singleIcon?.name) {
    return (
      <Center {...containerProps}>
        <Icon name={singleIcon.name} />
      </Center>
    );
  }
  return defaultIcon;
}

export function TxActionElementIconNormal(
  props: ComponentProps<typeof TxActionElementIcon>,
) {
  return <TxActionElementIcon size={28} {...props} />;
}

export function TxActionElementIconLarge(
  props: ComponentProps<typeof TxActionElementIcon>,
) {
  return <TxActionElementIcon size={32} {...props} />;
}

export function TxActionElementIconXLarge(
  props: ComponentProps<typeof TxActionElementIcon>,
) {
  return <TxActionElementIcon size={40} {...props} />;
}
