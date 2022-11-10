import { ComponentProps } from 'react';

import { List } from '@onekeyhq/components';

export enum TabEnum {
  Items = 'items',
  Sales = 'sales',
}

export type ListProps = {
  contractAddress: string;
  networkId: string;
} & Pick<ComponentProps<typeof List>, 'ListHeaderComponent'>;
