import CheckBoxBase from './CheckBox';
import CheckBoxGroup from './CheckBoxGroup';

/* eslint @typescript-eslint/no-unsafe-member-access: "off" */
const CheckTemp: any = CheckBoxBase;
CheckTemp.Group = CheckBoxGroup;

type ICheckboxComponentType = typeof CheckBoxBase & {
  Group: typeof CheckBoxGroup;
};

const Checkbox = CheckTemp as ICheckboxComponentType;

export default Checkbox;
