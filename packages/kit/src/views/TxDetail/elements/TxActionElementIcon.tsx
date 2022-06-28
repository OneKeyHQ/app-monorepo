import React, { ComponentProps } from 'react';

import { Center, Icon, Image } from '@onekeyhq/components';

import { ITxActionMeta } from '../types';

export function TxActionElementIcon(
  props: ITxActionMeta & {
    size?: number;
  },
) {
  const { iconInfo, size = 16 } = props;
  const sizePx = `${size}px`;
  const containerProps = {
    width: sizePx,
    height: sizePx,
    borderRadius: 'full',
    bg: 'background-selected',
    nativeID: 'TxActionElementIcon-Center-Container',
  };

  const defaultIcon = (
    <Center {...containerProps}>
      <Icon name="QuestionMarkOutline" />
    </Center>
  );
  if (!iconInfo || !iconInfo?.icon) {
    return defaultIcon;
  }
  const singleIcon = iconInfo.icon;
  if (!singleIcon) {
    return defaultIcon;
  }
  if (singleIcon?.url) {
    // packages/components/src/Token/index.tsx
    return (
      <Image
        key={singleIcon.url}
        src={singleIcon.url}
        width={sizePx}
        height={sizePx}
        borderRadius="full"
        fallbackElement={defaultIcon}
      />
    );
  }
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
