import { useCallback } from 'react';

import { type IPropsWithTestId, useClipboard } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { useMatchesDevSearch } from './DevSettingsSearchContext';

interface ISectionPressItem {
  title: string;
  icon?: IListItemProps['icon'];
  subtitle?: IListItemProps['subtitle'];
  onPress?: () => void;
  copyable?: boolean;
  drillIn?: boolean;
  /** Extra keywords for search matching (not displayed) */
  searchKeywords?: string;
}

export function SectionPressItem({
  title,
  icon,
  onPress,
  copyable,
  searchKeywords,
  ...restProps
}: IPropsWithTestId<ISectionPressItem>) {
  const { copyText } = useClipboard();
  const matches = useMatchesDevSearch(
    title,
    typeof restProps.subtitle === 'string' ? restProps.subtitle : undefined,
    searchKeywords,
  );
  const handleCopy = useCallback(() => {
    copyText(title);
    setTimeout(() => {
      onPress?.();
    });
  }, [copyText, title, onPress]);
  if (!matches) return null;
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
