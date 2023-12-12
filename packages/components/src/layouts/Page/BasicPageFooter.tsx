import { memo, useContext, useLayoutEffect } from 'react';

import { PageButtonGroup } from './PageButtonGroup';
import { PageContext } from './PageContext';

import type { IPageButtonGroupProps } from './PageButtonGroup';

export function BasicPageFooterContainer() {
  return <PageButtonGroup />;
}

export const BasicPageFooter = memo(BasicPageFooterContainer);

type IPageFooterProps = IPageButtonGroupProps;

export function PageContextFooter(props: IPageFooterProps) {
  const { setOptions, options } = useContext(PageContext);
  useLayoutEffect(() => {
    setOptions?.({
      ...options,
      footerOptions: props,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
