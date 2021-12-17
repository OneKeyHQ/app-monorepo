import CheckBoxInner from './CheckBox';
import CheckBoxGroup from './CheckBoxGroup';

/* eslint @typescript-eslint/no-unsafe-member-access: "off" */

const CheckTemp: any = CheckBoxInner;
CheckTemp.Group = CheckBoxGroup;

type ICheckboxComponentType = typeof CheckBoxInner & {
  Group: typeof CheckBoxGroup;
};

const Checkbox = CheckTemp as ICheckboxComponentType;

export default Checkbox;
