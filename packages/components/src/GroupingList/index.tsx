/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { SectionList as NBSectionList } from '@onekeyhq/components';
import type { SectionListProps } from '@onekeyhq/components/src/SectionList';

import Footer from '../List/Footer';
import Header from '../List/Header';
import ListItemSeparator from '../List/ListItemSeparator';

import SectionHeader from './SectionHeader';

import type { HeaderProps } from '../List/Header';

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
  const separator = useCallback(
    () => <ListItemSeparator showDivider={showDivider} />,
    [showDivider],
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
      ItemSeparatorComponent={separator}
      showsVerticalScrollIndicator={false}
      m={-2}
      sections={indexedSections}
      {...rest}
    />
  );
}

export default GroupingList;
