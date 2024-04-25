import { useCallback } from 'react';

import { type IPropsWithTestId, useClipboard } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

interface ISectionPressItem {
  title: string;
  onPress?: () => void;
  copyable?: boolean;
}

export function SectionPressItem({
  title,
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
      {...restProps}
    />
  );
}
