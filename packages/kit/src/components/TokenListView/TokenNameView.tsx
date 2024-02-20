import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack } from '@onekeyhq/components';

type IProps = {
  name: string;
  isNative?: boolean;
} & ISizableTextProps;

function TokenNameView(props: IProps) {
  const { name, isNative, ...rest } = props;

  const content = useMemo(
    () => (
      <XStack alignItems="center" space="$1">
        <SizableText {...rest}>{name}</SizableText>
        {isNative && <Icon name="GasSolid" color="$iconSubdued" size={20} />}
      </XStack>
    ),
    [rest, name, isNative],
  );
  return content;
}

export { TokenNameView };
