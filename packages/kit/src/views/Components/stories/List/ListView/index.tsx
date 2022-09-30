/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import { ReactElement, useCallback, useMemo } from 'react';

import {
  FlatList as NBFlatList,
  SectionList as NBSectionList,
} from '@onekeyhq/components';
import { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { SectionListProps } from '@onekeyhq/components/src/SectionList';

import Footer from './Footer';
import Header, { HeaderProps } from './Header';
import ListItem from './ListItem';
import ListItemSeparator from './ListItemSeparator';
import SectionHeader from './SectionHeader';

interface ListProps<T> extends FlatListProps<T> {
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

interface GroupingListProps<T> extends SectionListProps<T> {
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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
