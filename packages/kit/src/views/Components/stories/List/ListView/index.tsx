/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import { ReactElement, useCallback, useMemo } from 'react';

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
import SectionHeader from './SectionHeader';

interface ListProps<T> extends IFlatListProps<T> {
  headerProps?: HeaderProps;
  footerText?: string;
  showDivider?: boolean;
  ListHeaderComponent?: (props: HeaderProps) => JSX.Element;
}

function List<T>({
  ListHeaderComponent,
  ListFooterComponent,
  headerProps,
  footerText,
  showDivider,
  ...rest
}: ListProps<T>) {
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

interface GroupingListProps<T> extends ISectionListProps<T> {
  headerProps?: HeaderProps;
  footerText?: string;
  showDivider?: boolean;
  ListHeaderComponent?: (props: HeaderProps) => JSX.Element;
}

function GroupingList<T>({
  ListHeaderComponent,
  ListFooterComponent,
  headerProps,
  footerText,
  showDivider,
  renderSectionHeader,
  sections,
  ...rest
}: GroupingListProps<T>) {
  const header = useMemo(() => {
    if (headerProps) {
      if (ListHeaderComponent) return ListHeaderComponent(headerProps);
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
        mt={sections.indexOf(section) !== 0 ? '16px' : 0}
      />
    ),
    [sections],
  );

  return (
    <NBSectionList
      ListHeaderComponent={header}
      ListFooterComponent={
        footerText ? <Footer text={footerText} /> : ListFooterComponent
      }
      // @ts-expect-error
      renderSectionHeader={renderSectionHeader ?? renderSectionHeaderInner}
      ItemSeparatorComponent={() => (
        <ListItemSeparator showDivider={showDivider} />
      )}
      m={-2}
      sections={sections}
      {...rest}
    />
  );
}

export { List, GroupingList, ListItem };
