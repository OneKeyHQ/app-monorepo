import PressableBase from './Pressable';
import PressableItem from './PressableItem';

/* eslint @typescript-eslint/no-unsafe-member-access: "off" */
const PressableTemp: any = PressableBase;
PressableTemp.Item = PressableItem;

type IPressableComponentType = typeof PressableBase & {
  Item: typeof PressableItem;
};

const Pressable = PressableTemp as IPressableComponentType;

export default Pressable;
