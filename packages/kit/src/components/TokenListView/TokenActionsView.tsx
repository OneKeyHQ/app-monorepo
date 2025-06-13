import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenListMapAtom } from '../../states/jotai/contexts/tokenList';

import type { XStackProps } from 'tamagui';

type IProps = {
  $key: string;
} & XStackProps;

function TokenActionsView(props: IProps) {
  const { $key, ...rest } = props;
  const intl = useIntl();
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key || ''];

  const content = useMemo(
    () => (
      <XStack {...rest}>
        <Button size="small" variant="secondary">
          {intl.formatMessage({ id: ETranslations.global_swap })}
        </Button>
      </XStack>
    ),
    [intl, rest],
  );

  if (!token) {
    return null;
  }

  return content;
}

export { TokenActionsView };
