import { memo, useContext, useEffect } from 'react';

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
  useEffect(() => {
    setOptions?.({
      ...options,
      footerOptions: props,
    });
  }, [options, props, setOptions]);
  return null;
}
