import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISizableTextProps } from '@onekeyhq/components';
import { Icon, SizableText, Tooltip, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  name: string;
  isNative?: boolean;
} & ISizableTextProps;

function TokenNameView(props: IProps) {
  const { name, isNative, ...rest } = props;
  const intl = useIntl();

  const content = useMemo(
    () => (
      <XStack alignItems="center" space="$1" flex={1}>
        <SizableText numberOfLines={1} {...rest}>
          {name}
        </SizableText>
        {isNative ? (
          <Tooltip
            renderContent={intl.formatMessage({
              id: ETranslations.native_token_tooltip,
            })}
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
    [rest, name, isNative, intl],
  );
  return content;
}

export { TokenNameView };
