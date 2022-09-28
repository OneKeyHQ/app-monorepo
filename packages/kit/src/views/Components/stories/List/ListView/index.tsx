/* eslint-disable no-nested-ternary */
import React, { ComponentProps, FC } from 'react';

import {
  FlatList as NBFlatList,
  SectionList as NBSectionList,
} from '@onekeyhq/components';

import Footer, { FooterProps } from './Footer';
import Header, { HeaderProps } from './Header';
import ListItem from './ListItem';
import ListItemSeparator, { ListItemSeparatorProps } from './ListItemSeparator';

type ListProps = {
  header?: HeaderProps;
  footer?: FooterProps['footer'];
  showDivider?: ListItemSeparatorProps['showDivider'];
};

/* 
  FlatList
*/
type FlatListProps = {
  customHeader?: ComponentProps<typeof NBFlatList>['ListHeaderComponent'];
} & ComponentProps<typeof NBFlatList>;

const FlatList: FC<ListProps & FlatListProps> = ({
  customHeader,
  header,
  footer,
  showDivider,
  ...rest
}) => {
  function renderHeader() {
    if (customHeader) return customHeader;
    if (header) return <Header title={header.title} actions={header.actions} />;

    return null;
  }

  return (
    <NBFlatList
      ListHeaderComponent={renderHeader()}
      ListFooterComponent={<Footer footer={footer} />}
      ItemSeparatorComponent={() => (
        <ListItemSeparator showDivider={showDivider} />
      )}
      m={-2}
      {...rest}
    />
  );
};

/* 
  SectionList
*/

type SectionListProps = {
  customHeader?: ComponentProps<typeof NBSectionList>['ListHeaderComponent'];
} & ComponentProps<typeof NBSectionList>;

const SectionList: FC<ListProps & SectionListProps> = ({
  customHeader,
  header,
  footer,
  showDivider,
  ...rest
}) => {
  function renderHeader() {
    if (customHeader) return customHeader;
    if (header) return <Header title={header.title} actions={header.actions} />;

    return null;
  }

  return (
    <NBSectionList
      ListHeaderComponent={renderHeader()}
      ListFooterComponent={footer ? <Footer footer={footer} /> : null}
      ItemSeparatorComponent={() => (
        <ListItemSeparator showDivider={showDivider} />
      )}
      m={-2}
      {...rest}
    />
  );
};

export { FlatList, SectionList, ListItem };
