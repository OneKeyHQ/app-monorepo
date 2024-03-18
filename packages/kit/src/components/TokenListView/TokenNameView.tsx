import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { Icon, SizableText, Tooltip, XStack } from '@onekeyhq/components';

type IProps = {
  name: string;
  isNative?: boolean;
} & ISizableTextProps;

function TokenNameView(props: IProps) {
  const { name, isNative, ...rest } = props;

  const content = useMemo(
    () => (
      <XStack alignItems="center" space="$1" flex={1}>
        <SizableText numberOfLines={1} {...rest}>
          {name}
        </SizableText>
        {isNative ? (
          <Tooltip
            renderContent="This is the cryptocurrency used to pay for network fees"
            renderTrigger={
              <Icon
                flexShrink={0}
                name="GasSolid"
                color="$iconSubdued"
                size="$5"
              />
            }
          />
        ) : null}
      </XStack>
    ),
    [rest, name, isNative],
  );
  return content;
}

export { TokenNameView };
