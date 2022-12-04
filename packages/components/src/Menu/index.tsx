import { Menu as MenuBase } from 'native-base';

import CustomItem from './CustomItem';

const Menu = MenuBase;

// @ts-ignore
Menu.CustomItem = CustomItem;

type IMenuComponentType = typeof Menu & {
  CustomItem: typeof CustomItem;
};

export default Menu as IMenuComponentType;
