import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

import SwapCommonInfoItem from '../../../components/SwapCommonInfoItem';

import {
  ITEM_CONTAINER_PROPS,
  ITEM_TITLE_PROPS,
  ITEM_VALUE_PROPS,
} from './constants';

export type ISwapProTokenDetailRow = {
  titleId: ETranslations;
  valueComponent: ReactNode;
};

export function SwapProTokenDetailRows({
  rows,
}: {
  rows: ISwapProTokenDetailRow[];
}) {
  const intl = useIntl();

  return (
    <YStack>
      {rows.map((row, index) => (
        <SwapCommonInfoItem
          key={row.titleId}
          title={intl.formatMessage({ id: row.titleId })}
          valueComponent={row.valueComponent}
          titleProps={ITEM_TITLE_PROPS}
          valueProps={ITEM_VALUE_PROPS}
          containerProps={index === 2 ? undefined : ITEM_CONTAINER_PROPS}
        />
      ))}
    </YStack>
  );
}
