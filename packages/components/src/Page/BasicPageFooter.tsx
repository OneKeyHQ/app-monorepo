import { memo, useContext, useEffect } from 'react';

import { XStack } from '../Stack';

import { PageButtonGroup } from './PageButtonGroup';
import { PageContext } from './PageContext';

import type { IPageButtonGroupProps } from './PageButtonGroup';

export function BasicPageFooterContainer() {
  return (
    <XStack
      bg="$bg"
      padding="$5"
      $sm={{
        flexDirection: 'column',
        alignItems: 'center',
      }}
      $gtSm={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <PageButtonGroup />
    </XStack>
  );
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
