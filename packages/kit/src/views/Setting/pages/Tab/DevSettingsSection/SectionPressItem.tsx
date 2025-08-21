import { useCallback } from 'react';

import { type IPropsWithTestId, useClipboard } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

interface ISectionPressItem {
  title: string;
  icon?: IListItemProps['icon'];
  subtitle?: IListItemProps['subtitle'];
  onPress?: () => void;
  copyable?: boolean;
  drillIn?: boolean;
}

export function SectionPressItem({
  title,
  icon,
  onPress,
  copyable,
  ...restProps
}: IPropsWithTestId<ISectionPressItem>) {
  const { copyText } = useClipboard();
  const handleCopy = useCallback(() => {
    copyText(title);
  }, [copyText, title]);
  return (
    <ListItem
      drillIn
      onPress={copyable ? handleCopy : onPress}
      title={title}
      titleProps={{ color: '$textCritical' }}
      icon={icon}
      {...restProps}
    />
  );
}
