import { useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { XStack } from '@onekeyhq/components';
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
  isCustomNetworkEditable?: boolean;
  drag?: () => void;
  dragProps?: Record<string, any>;
};

const EditableListItemPinOrNot = ({ item }: { item: IServerNetworkMatch }) => {
  const {
    frequentlyUsedItems,
    frequentlyUsedItemsIds,
    setFrequentlyUsedItems,
  } = useContext(EditableChainSelectorContext);
  const intl = useIntl();

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
    <ListItem.IconButton
      onPress={onPinOrNot}
      title={
        frequentlyUsedItemsIds.has(item.id)
          ? intl.formatMessage({
              id: ETranslations.global_unpin_from_top,
            })
          : intl.formatMessage({ id: ETranslations.global_pin_to_top })
      }
      key="moveToTop"
      icon={
        frequentlyUsedItemsIds.has(item.id)
          ? 'ThumbackRotateOffOutline'
          : 'ThumbackRotateOutline'
      }
      iconProps={{
        color: '$iconSubdued',
      }}
    />
  );
};

export const EditableListItem = ({
  item,
  drag,
  dragProps,
  isDisabled,
  isDraggable,
  isEditable = true,
  isCustomNetworkEditable,
}: IEditableListItemProps) => {
  const intl = useIntl();
  const { isEditMode, networkId, onPressItem, onEditCustomNetwork } =
    useContext(EditableChainSelectorContext);

  const onPress = useMemo(() => {
    if (!isEditMode) {
      return () => onPressItem?.(item);
    }
    return undefined;
  }, [isEditMode, item, onPressItem]);

  return (
    <ListItem
      testID={item.id}
      title={
        item.isAllNetworks
          ? intl.formatMessage({ id: ETranslations.global_all_networks })
          : item.name
      }
      titleMatch={item.titleMatch}
      h={CELL_HEIGHT}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={item.logoURI}
          isCustomNetwork={item.isCustomNetwork}
          networkName={item.name}
          size="$8"
        />
      }
      onPress={onPress}
      disabled={isDisabled}
    >
      <XStack gap="$5">
        {isCustomNetworkEditable && isEditMode && !isDisabled ? (
          <ListItem.IconButton
            icon="PencilOutline"
            title={intl.formatMessage({ id: ETranslations.global_edit })}
            onPress={() => onEditCustomNetwork?.(item)}
          />
        ) : null}
        {isEditable && isEditMode && !isDisabled && !isDraggable ? (
          <EditableListItemPinOrNot item={item} />
        ) : null}
        {isEditMode && isDraggable ? (
          <>
            <EditableListItemPinOrNot item={item} />
            <ListItem.IconButton
              key="darg"
              cursor="move"
              icon="DragOutline"
              onPressIn={drag}
              dataSet={dragProps}
            />
          </>
        ) : null}
        {networkId === item.id && !isEditMode ? (
          <ListItem.CheckMark key="checkmark" />
        ) : null}
      </XStack>
    </ListItem>
  );
};
