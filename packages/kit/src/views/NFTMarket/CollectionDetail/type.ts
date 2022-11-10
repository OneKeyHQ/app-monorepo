import { FlatListProps } from '@onekeyhq/components/src/FlatList';

export enum TabEnum {
  Items = 'items',
  Sales = 'sales',
}

export type ListProps = {
  contractAddress: string;
  networkId: string;
} & Pick<FlatListProps, 'ListHeaderComponent'>;
