/* eslint-disable no-nested-ternary */
import { FC, useMemo } from 'react';

import { IFlatListProps } from 'native-base/lib/typescript/components/basic/FlatList/types';
import { ISectionListProps } from 'native-base/lib/typescript/components/basic/SectionList/types';

import {
  FlatList as NBFlatList,
  SectionList as NBSectionList,
} from '@onekeyhq/components';

import Footer from './Footer';
import Header, { HeaderProps } from './Header';
import ListItem from './ListItem';
import ListItemSeparator from './ListItemSeparator';

interface FlatListProps<T = any> extends IFlatListProps<T> {
  headerProps?: HeaderProps;
  footerText?: string;
  showDivider?: boolean;
  ListHeaderComponent?: (props: HeaderProps) => JSX.Element;
}

const FlatList: FC<FlatListProps> = ({
  ListHeaderComponent,
  ListFooterComponent,
  headerProps,
  footerText,
  showDivider,
  ...rest
}) => {
  const renderHeader = useMemo(() => {
    if (headerProps) {
      if (ListHeaderComponent) return ListHeaderComponent(headerProps);
      return <Header {...headerProps} />;
    }
    return null;
  }, [ListHeaderComponent, headerProps]);

  return (
    <NBFlatList
      ListHeaderComponent={renderHeader}
      ListFooterComponent={
        footerText ? <Footer text={footerText} /> : ListFooterComponent
      }
      ItemSeparatorComponent={() => (
        <ListItemSeparator showDivider={showDivider} />
      )}
      m={-2}
      {...rest}
    />
  );
};

interface SectionListProps<T = any> extends ISectionListProps<T> {
  headerProps?: HeaderProps;
  footerText?: string;
  showDivider?: boolean;
  ListHeaderComponent?: (props: HeaderProps) => JSX.Element;
}

const SectionList: FC<SectionListProps> = ({
  ListHeaderComponent,
  ListFooterComponent,
  headerProps,
  footerText,
  showDivider,
  ...rest
}) => {
  const renderHeader = useMemo(() => {
    if (headerProps) {
      if (ListHeaderComponent) return ListHeaderComponent(headerProps);
      return <Header {...headerProps} />;
    }
    return null;
  }, [ListHeaderComponent, headerProps]);

  return (
    <NBSectionList
      ListHeaderComponent={renderHeader}
      ListFooterComponent={
        footerText ? <Footer text={footerText} /> : ListFooterComponent
      }
      ItemSeparatorComponent={() => (
        <ListItemSeparator showDivider={showDivider} />
      )}
      m={-2}
      {...rest}
    />
  );
};

export { FlatList, SectionList, ListItem };
