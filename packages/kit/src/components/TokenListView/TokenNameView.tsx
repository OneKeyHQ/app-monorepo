import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISizableTextProps } from '@onekeyhq/components';
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
} & ISizableTextProps;

function TokenNameView(props: IProps) {
  const { name, isNative, isAllNetworks, withNetwork, networkId, ...rest } =
    props;
  const intl = useIntl();

  const { network } = useAccountData({ networkId });

  const content = useMemo(
    () => (
      <XStack alignItems="center" gap="$1" flex={1}>
        <SizableText numberOfLines={1} {...rest}>
          {name}
        </SizableText>
        {withNetwork && network ? <Badge>{network.name}</Badge> : null}
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
    [rest, name, withNetwork, network, isNative, isAllNetworks, intl],
  );
  return content;
}

export { TokenNameView };
