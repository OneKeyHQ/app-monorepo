/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import {
  FlatList as NBFlatList,
  SectionList as NBSectionList,
} from '@onekeyhq/components';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import type { SectionListProps } from '@onekeyhq/components/src/SectionList';

import Footer from './Footer';
import Header from './Header';
import ListItem from './ListItem';
import ListItemSeparator from './ListItemSeparator';
import SectionHeader from './SectionHeader';

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

  return (
    <NBFlatList
      ListHeaderComponent={header}
      ListFooterComponent={
        footerText ? <Footer text={footerText} /> : ListFooterComponent
      }
      ItemSeparatorComponent={() => (
        <ListItemSeparator showDivider={showDivider} />
      )}
      showsVerticalScrollIndicator={false}
      m={-2}
      {...rest}
    />
  );
}

interface GroupingListRow {
  iconName?: string;
  label?: string;
}
export interface GroupingListSection {
  headerProps?: HeaderProps;
  footerText?: string;
  data: {
    iconName?: string;
    label?: string;
    rightContent?: (_data: GroupingListRow) => ReactElement;
  }[];
}

interface GroupingListProps<T> extends SectionListProps<T> {
  headerProps?: HeaderProps;
  footerText?: string;
  showDivider?: boolean;
  ListHeaderComponent?: () => JSX.Element;
}

function GroupingList<T>({
  ListHeaderComponent,
  ListFooterComponent,
  headerProps,
  footerText,
  showDivider,
  renderSectionHeader,
  renderSectionFooter,
  sections,
  ...rest
}: GroupingListProps<T>) {
  const indexedSections = useMemo(
    () => sections.map((section, index) => ({ ...section, __index: index })),
    [sections],
  );
  const header = useMemo(() => {
    if (ListHeaderComponent) return ListHeaderComponent();
    if (headerProps) {
      return <Header {...headerProps} />;
    }
    return null;
  }, [ListHeaderComponent, headerProps]);

  const renderSectionHeaderInner = useCallback(
    ({ section }: { section: GroupingListSection }) => (
      <SectionHeader
        title={section?.headerProps?.title}
        actions={section?.headerProps?.actions}
        // @ts-expect-error
        mt={section.__index !== 0 ? '16px' : 0}
        {...section?.headerProps}
      />
    ),
    [],
  );

  const renderSectionFooterInner = useCallback(
    ({ section }: { section: GroupingListSection }) =>
      section.footerText ? <Footer text={section.footerText} /> : null,
    [],
  );

  return (
    <NBSectionList
      ListHeaderComponent={header}
      ListFooterComponent={
        footerText ? <Footer text={footerText} /> : ListFooterComponent
      }
      // @ts-expect-error
      renderSectionHeader={renderSectionHeader ?? renderSectionHeaderInner}
      // @ts-expect-error
      renderSectionFooter={renderSectionFooter ?? renderSectionFooterInner}
      ItemSeparatorComponent={() => (
        <ListItemSeparator showDivider={showDivider} />
      )}
      showsVerticalScrollIndicator={false}
      m={-2}
      sections={indexedSections}
      {...rest}
    />
  );
}

export { List, GroupingList, ListItem };
