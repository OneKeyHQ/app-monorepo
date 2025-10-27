import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';

import { SizableText, XStack } from '../../../primitives';
import { useSortIcon } from '../hooks';

import type { IXStackProps } from '../../../primitives';
import type { ETableSortType, ITableColumn } from '../types';

interface IColumnProps<T> {
  name: string;
  showSortIcon?: boolean;
  order?: 'asc' | 'desc' | undefined;
  align?: ITableColumn<T>['align'];
  onPress?: () => void;
  cursor?: string;
  width?: IXStackProps['width'];
  disabledSorts?: ETableSortType[];
}

export function Column<T>({
  children,
  width,
  showSortIcon,
  order,
  onPress,
  cursor,
  name,
  align = 'left',
  disabledSorts,
  ...props
}: PropsWithChildren<IColumnProps<T> & Omit<IXStackProps, 'onPress'>>) {
  const jc = useMemo(() => {
    if (align === 'left') {
      return 'flex-start';
    }
    if (align === 'right') {
      return 'flex-end';
    }
    return 'center';
  }, [align]);

  const { renderSortIcon } = useSortIcon({
    showSortIcon,
    order,
    cursor,
    disabledSorts,
  });
  return (
    <XStack
      key={name}
      testID={`list-column-${name}`}
      jc={jc}
      ai="center"
      alignItems="center"
      width={width}
      onPress={onPress}
      cursor={cursor}
      userSelect="none"
      {...props}
    >
      {jc === 'flex-end' ? renderSortIcon() : null}
      {typeof children === 'string' ? (
        <SizableText color="$textSubdued" size="$bodySmMedium">
          {children}
        </SizableText>
      ) : (
        children
      )}
      {jc === 'flex-start' ? renderSortIcon() : null}
    </XStack>
  );
}
