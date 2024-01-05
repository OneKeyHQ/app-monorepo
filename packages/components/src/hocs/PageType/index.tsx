import type { ComponentType } from 'react';
import { useContext, useMemo } from 'react';

import { PageTypeContext } from './context';

import type { IPageTypeContextType } from './context';

const map = new Map();
export enum EPageType {
  modal = 'modal',
  stack = 'stack',
}
export const PageTypeHOC = (
  name: string,
  pageType: EPageType,
  Component: ComponentType<any>,
) => {
  const key = `${name}-${pageType}`;
  if (map.get(key)) {
    return map.get(key) as ComponentType<any>;
  }
  function ModalContainer(props: any) {
    const value = useMemo(
      () =>
        ({
          pageType,
        } as IPageTypeContextType),
      [],
    );

    return (
      <PageTypeContext.Provider value={value}>
        <Component {...props} />
      </PageTypeContext.Provider>
    );
  }
  map.set(key, ModalContainer);
  return ModalContainer;
};

export const usePageType = () => {
  const pageTypeContext = useContext(PageTypeContext);
  return pageTypeContext.pageType;
};
