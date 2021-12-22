import React, { ComponentProps, FC } from 'react';

import { TouchableOpacity } from 'react-native';
import SortableList, { ScaleDecorator } from 'react-native-draggable-flatlist';

type SortableListItemProps = {
  scale?: boolean;
  activeScale?: number;
};

export const SortableListItem: FC<
  SortableListItemProps & ComponentProps<typeof TouchableOpacity>
> = ({ scale, activeScale, ...props }) =>
  scale ? (
    <ScaleDecorator activeScale={activeScale}>
      <TouchableOpacity {...props} />
    </ScaleDecorator>
  ) : (
    <TouchableOpacity {...props} />
  );

/* eslint @typescript-eslint/no-unsafe-member-access: "off" */
const SortableListTemp: any = SortableList;
SortableListTemp.ListItem = SortableListItem;

type ISortableListComponentType = typeof SortableList & {
  ListItem: typeof SortableListItem;
};

const SortableListBase = SortableListTemp as ISortableListComponentType;

export default SortableListBase;
