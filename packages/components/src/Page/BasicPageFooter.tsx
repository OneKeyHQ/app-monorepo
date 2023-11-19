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
  const { setOptions } = useContext(PageContext);
  useEffect(() => {
    setOptions?.({
      footerOptions: props,
    });
    return () => {
      setOptions?.(undefined);
    };
  }, [props, setOptions]);
  return null;
}
