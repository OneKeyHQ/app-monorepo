import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Badge, EPageType, SizableText, XStack } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';

interface ISwapHeaderContainerProps {
  pageType?: EPageType.modal;
}

const SwapHeaderContainer = ({ pageType }: ISwapHeaderContainerProps) => {
  const intl = useIntl();
  const headerRight = useCallback(
    () => (
      <SwapHeaderRightActionContainer
        storeName={
          pageType === EPageType.modal
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
          {intl.formatMessage({ id: ETranslations.swap_page_swap })}
        </SizableText>

        <XStack opacity={0.5} space="$1">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.swap_page_limit })}
          </SizableText>
          <Badge badgeSize="sm" badgeType="default">
            {intl.formatMessage({ id: ETranslations.coming_soon })}
          </Badge>
        </XStack>
      </XStack>
      {headerRight()}
    </XStack>
  );
};

export default memo(SwapHeaderContainer);
