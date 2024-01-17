import { forwardRef, useCallback, useMemo } from 'react';
import type { ComponentType, ReactElement } from 'react';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PageContentView, PageManager } from 'react-native-tab-page-view';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Header } from './Header';

import type { IHeaderProps } from './Header';
import type { GetProps } from 'tamagui';

type IPageType = ComponentType;

export interface ITabProps
  extends Omit<GetProps<typeof PageContentView>, 'renderItem'> {
  data: { title: string; page: IPageType }[];
  initialScrollIndex?: number;
  ListHeaderComponent?: ReactElement;
  ListFooterComponent?: ReactElement;
  headerProps?: Omit<IHeaderProps, 'data'>;
}

const PageComponent = (
  {
    data,
    initialScrollIndex,
    ListHeaderComponent,
    ListFooterComponent,
    headerProps,
    ...props
  }: ITabProps,
  // fix missing forwardRef warnings.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _: any,
) => {
  const pageManagerProps = useMemo(
    () => ({
      data,
      initialScrollIndex,
    }),
    [data, initialScrollIndex],
  );
  const pageManager = useMemo(
    () => new PageManager(pageManagerProps),
    [pageManagerProps],
  );
  const Content = pageManager.renderContentView;
  const renderContentItem = useCallback(
    ({
      item,
    }: {
      item: {
        page: IPageType;
      };
    }) => <item.page />,
    [],
  );
  return (
    <>
      {ListHeaderComponent}
      <Header
        ref={pageManager.headerView}
        {...pageManagerProps}
        {...headerProps}
        onSelectedPageIndex={(pageIndex: number) => {
          pageManager?.contentView?.current?.scrollPageIndex(pageIndex);
        }}
      />
      <Content
        windowSize={5}
        scrollEnabled={platformEnv.isNative}
        shouldSelectedPageAnimation={platformEnv.isNative}
        renderItem={renderContentItem}
        {...props}
      />
      {ListHeaderComponent}
    </>
  );
};

export const Page = forwardRef(PageComponent);
