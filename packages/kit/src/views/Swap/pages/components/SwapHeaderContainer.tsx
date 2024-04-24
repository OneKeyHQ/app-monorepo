import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';

interface ISwapHeaderContainerProps {
  hiddenRightAction?: boolean;
  pageType?: 'modal' | undefined;
}

const SwapHeaderContainer = ({
  hiddenRightAction,
  pageType,
}: ISwapHeaderContainerProps) => {
  const intl = useIntl();
  const headerRight = useCallback(
    () => (
      <SwapHeaderRightActionContainer
        storeName={
          pageType === 'modal'
            ? EJotaiContextStoreNames.swapModal
            : EJotaiContextStoreNames.swap
        }
      />
    ),
    [pageType],
  );
  return (
    <XStack justifyContent="space-between">
      <XStack space="$5">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: 'title__swap' })}
        </SizableText>

        <XStack opacity={0.5} space="$1">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: 'form__limit' })}
          </SizableText>
        </XStack>
      </XStack>
      {!hiddenRightAction ? headerRight() : null}
    </XStack>
  );
};

export default memo(SwapHeaderContainer);
