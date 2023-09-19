import PressableBase from './Pressable';
import PressableItem from './PressableItem';

const Pressable = PressableBase;
// @ts-ignore
Pressable.Item = PressableItem;

type IPressableComponentType = typeof PressableBase & {
  Item: typeof PressableItem;
};

export default Pressable as IPressableComponentType;
