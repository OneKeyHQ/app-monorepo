/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import { useCallback, useMemo } from 'react';

import { FlatList as NBFlatList } from '@onekeyhq/components';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';

import Footer from './Footer';
import Header from './Header';
import ListItemSeparator from './ListItemSeparator';

import type { HeaderProps } from './Header';

interface ListProps<T> extends FlatListProps<T> {
  headerProps?: HeaderProps;
  footerText?: string;
  showDivider?: boolean;
  ListHeaderComponent?: () => JSX.Element;
}

function List<T>({
  ListHeaderComponent,
  ListFooterComponent,
  headerProps,
  footerText,
  showDivider,
  ...rest
}: ListProps<T>) {
  const header = useMemo(() => {
    if (ListHeaderComponent) return ListHeaderComponent();
    if (headerProps) {
      return <Header {...headerProps} />;
    }
    return null;
  }, [ListHeaderComponent, headerProps]);
  const separator = useCallback(
    () => <ListItemSeparator showDivider={showDivider} />,
    [showDivider],
  );

  return (
    <NBFlatList
      ListHeaderComponent={header}
      ListFooterComponent={
        footerText ? <Footer text={footerText} /> : ListFooterComponent
      }
      ItemSeparatorComponent={separator}
      showsVerticalScrollIndicator={false}
      m={-2}
      {...rest}
    />
  );
}

export default List;
