import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISizableTextProps, IXStackProps } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  SizableText,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useAccountData } from '../../hooks/useAccountData';

type IProps = {
  name: string;
  isNative?: boolean;
  isAllNetworks?: boolean;
  withNetwork?: boolean;
  networkId: string | undefined;
  textProps?: ISizableTextProps;
} & IXStackProps;

function TokenNameView(props: IProps) {
  const {
    name,
    isNative,
    isAllNetworks,
    withNetwork,
    networkId,
    textProps,
    ...rest
  } = props;
  const intl = useIntl();

  const { network } = useAccountData({ networkId });

  const content = useMemo(
    () => (
      <XStack alignItems="center" gap="$1" {...rest}>
        <SizableText minWidth={0} numberOfLines={1} {...textProps}>
          {name}
        </SizableText>
        {withNetwork && network ? (
          <Badge flexShrink={1}>
            <Badge.Text numberOfLines={1}>{network.name}</Badge.Text>
          </Badge>
        ) : null}
        {isNative && !isAllNetworks ? (
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
    [
      rest,
      textProps,
      name,
      withNetwork,
      network,
      isNative,
      isAllNetworks,
      intl,
    ],
  );
  return content;
}

export { TokenNameView };
