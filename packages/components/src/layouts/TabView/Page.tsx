import { forwardRef, useCallback, useMemo } from 'react';
import type { ComponentType, ReactElement } from 'react';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  PageContentView,
  PageManager,
} from '@onekeyfe/react-native-tab-page-view';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Header } from './Header';

import type { IHeaderProps } from './Header';
import type { GetProps } from 'tamagui';

type IContentType = ComponentType;

export interface IPageContainerProps
  extends Omit<GetProps<typeof PageContentView>, 'renderItem'> {
  data: { title: string; page: IContentType }[];
  initialScrollIndex?: number;
  ListHeaderComponent?: ReactElement;
  ListFooterComponent?: ReactElement;
  headerProps?: Omit<IHeaderProps, 'data'>;
  onSelectedPageIndex?: (pageIndex: number) => void;
  shouldSelectedPageIndex?: (pageIndex: number) => boolean;
}

const PageComponent = (
  {
    data,
    initialScrollIndex,
    ListHeaderComponent,
    ListFooterComponent,
    headerProps,
    onSelectedPageIndex,
    shouldSelectedPageIndex,
    ...props
  }: IPageContainerProps,
  // fix missing forwardRef warnings.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _: any,
) => {
  const pageManagerProps = useMemo(
    () => ({
      data,
      initialScrollIndex,
      onSelectedPageIndex,
    }),
    [data, initialScrollIndex, onSelectedPageIndex],
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
        page: IContentType;
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
        shouldSelectedPageIndex={shouldSelectedPageIndex}
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
      {ListFooterComponent}
    </>
  );
};

export const Page = forwardRef(PageComponent);
