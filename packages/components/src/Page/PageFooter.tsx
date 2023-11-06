import { useContext, useEffect } from 'react';

import { PageContext } from './PageContext';

import type { IPageButtonGroupProps } from './PageButtonGroup';

export function PageFooter(props: IPageButtonGroupProps) {
  const { setOptions } = useContext(PageContext);
  useEffect(() => {
    setOptions?.({
      footerOptions: props,
    });
  }, [props, setOptions]);
  return null;
}
