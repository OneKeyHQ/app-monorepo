import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';

import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';

const SwapHeaderContainer = () => {
  const intl = useIntl();
  const headerRight = useCallback(() => <SwapHeaderRightActionContainer />, []);
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
          {/* <Badge badgeSize="sm">Soon</Badge> */}
        </XStack>
      </XStack>
      {headerRight()}
    </XStack>
  );
};

export default memo(SwapHeaderContainer);
