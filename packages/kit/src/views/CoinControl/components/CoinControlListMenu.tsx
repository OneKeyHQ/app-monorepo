import type { FC } from 'react';
import { useMemo } from 'react';

import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

const CoinControlListMenu: FC<
  IMenu & {
    sortByIndex: number;
    onSortByChange: (value: number) => void;
    infoIndex: number;
    onInfoChange: (value: number) => void;
  }
> = ({ sortByIndex, onSortByChange, infoIndex, onInfoChange, ...props }) => {
  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        // @ts-expect-error
        type: 'radio',
        title: 'form__sort_by__uppercase',
        defaultValue: sortByIndex,
        children: [
          {
            id: 'action__utxo_balance',
            value: 1,
          },
          {
            id: 'action__utxo_age',
            value: 2,
          },
          {
            id: 'action__utxo_address',
            value: 3,
          },
          {
            id: 'action__utxo_label',
            value: 4,
          },
        ],
        // @ts-expect-error
        onChange: onSortByChange,
      },
      {
        // @ts-expect-error
        type: 'radio',
        title: 'form__information__uppercase',
        defaultValue: infoIndex,
        children: [
          {
            id: 'action__view_mined_time',
            value: 1,
          },
          {
            id: 'action__view_path',
            value: 2,
          },
        ],
        // @ts-expect-error
        onChange: onInfoChange,
      },
    ],
    [],
  );

  return <BaseMenu closeOnSelect={false} options={options} {...props} />;
};

export { CoinControlListMenu };
