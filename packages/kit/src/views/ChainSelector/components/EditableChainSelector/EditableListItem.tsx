import { useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EditableChainSelectorContext } from './context';
import { CELL_HEIGHT } from './type';

import type { IServerNetworkMatch } from '../../types';

type IEditableListItemProps = {
  item: IServerNetworkMatch;
  isDraggable?: boolean;
  isDisabled?: boolean;
  isEditable?: boolean;
  drag?: () => void;
};

export const EditableListItem = ({
  item,
  drag,
  isDisabled,
  isDraggable,
  isEditable = true,
}: IEditableListItemProps) => {
  const intl = useIntl();
  const {
    isEditMode,
    networkId,
    frequentlyUsedItems,
    frequentlyUsedItemsIds,
    setFrequentlyUsedItems,
    onPressItem,
  } = useContext(EditableChainSelectorContext);

  const opacity = isDisabled ? 0.7 : 1;

  const onPress = useMemo(() => {
    if (!isEditMode && !isDisabled) {
      return () => onPressItem?.(item);
    }
    return undefined;
  }, [isEditMode, isDisabled, item, onPressItem]);

  const onPinOrNot = useCallback(() => {
    if (frequentlyUsedItemsIds.has(item.id)) {
      setFrequentlyUsedItems?.([
        ...frequentlyUsedItems.filter((o) => o.id !== item.id),
      ]);
    } else {
      setFrequentlyUsedItems?.([...frequentlyUsedItems, item]);
    }
  }, [
    frequentlyUsedItemsIds,
    frequentlyUsedItems,
    item,
    setFrequentlyUsedItems,
  ]);

  return (
    <ListItem
      title={
        item.isAllNetworks
          ? intl.formatMessage({ id: ETranslations.global_all_networks })
          : item.name
      }
      titleMatch={item.titleMatch}
      h={CELL_HEIGHT}
      renderAvatar={<NetworkAvatarBase logoURI={item.logoURI} size="$8" />}
      opacity={opacity}
      onPress={onPress}
    >
      {isEditable && isEditMode && !isDisabled && !isDraggable ? (
        <ListItem.IconButton
          onPress={onPinOrNot}
          title={
            frequentlyUsedItemsIds.has(item.id)
              ? intl.formatMessage({ id: ETranslations.global_unpin_from_top })
              : intl.formatMessage({ id: ETranslations.global_pin_to_top })
          }
          key="moveToTop"
          icon={
            frequentlyUsedItemsIds.has(item.id)
              ? 'ThumbtackSolid'
              : 'ThumbtackOutline'
          }
          iconProps={{
            color: frequentlyUsedItemsIds.has(item.id)
              ? '$iconActive'
              : '$iconSubdued',
          }}
        />
      ) : null}
      {networkId === item.id && !isEditMode ? (
        <ListItem.CheckMark key="checkmark" />
      ) : null}
      {isEditMode && isDraggable ? (
        <ListItem.IconButton
          key="darg"
          cursor="move"
          icon="DragOutline"
          onPressIn={drag}
        />
      ) : null}
    </ListItem>
  );
};
