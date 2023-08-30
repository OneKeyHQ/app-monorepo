import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

export function useCoinControlListMenu(): {
  menuSortByIndex: number;
  menuInfoIndex: number;
  onSortByChange: (value: number) => void;
  onInfoChange: (value: number) => void;
  showPath: boolean;
  sortMethod: 'balance' | 'height' | 'address' | 'label';
} {
  const [menuSortByIndex, setMenuSortByIndex] = useState(1);
  const [menuInfoIndex, setMenuInfoIndex] = useState(1);
  const onSortByChange = useCallback((value: number) => {
    setMenuSortByIndex(value);
  }, []);
  const onInfoChange = useCallback((value: number) => {
    setMenuInfoIndex(value);
  }, []);
  const showPath = useMemo(() => menuInfoIndex === 2, [menuInfoIndex]);
  const sortMethod = useMemo(() => {
    switch (menuSortByIndex) {
      case 1:
        return 'balance';
      case 2:
        return 'height';
      case 3:
        return 'address';
      case 4:
        return 'label';
      default:
        return 'balance';
    }
  }, [menuSortByIndex]);

  return {
    menuSortByIndex,
    menuInfoIndex,
    onSortByChange,
    onInfoChange,
    showPath,
    sortMethod,
  };
}

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
    [sortByIndex, onSortByChange, infoIndex, onInfoChange],
  );

  return <BaseMenu closeOnSelect={false} options={options} {...props} />;
};

export { CoinControlListMenu };
