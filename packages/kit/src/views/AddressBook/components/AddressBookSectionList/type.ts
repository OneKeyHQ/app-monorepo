import type { ComponentType, ReactElement } from 'react';

import type { IAddressNetworkExtendMatch } from '../../type';

type ISectionItem = {
  title: string;
  data: IAddressNetworkExtendMatch[];
};

export type IAddressBookSectionListProps = {
  sections: ISectionItem[];
  renderItem: (params: {
    item: IAddressNetworkExtendMatch;
  }) => ReactElement | null;
  ListEmptyComponent?: ComponentType<any> | ReactElement | null | undefined;
  renderSectionHeader: (params: {
    section: {
      title: string;
      data: IAddressNetworkExtendMatch[];
      isFold?: boolean;
    };
  }) => ReactElement | null;
  keyExtractor?: (item: unknown, index: number) => string;
  showsVerticalScrollIndicator?: boolean;
  estimatedItemSize: number;
};
