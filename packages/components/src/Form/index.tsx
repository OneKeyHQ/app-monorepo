import { Form as BaseForm } from './Form';
import { FormCheckBox } from './FormCheckBox';
import { FormInput } from './FormInput';
import { FormItem } from './FormItem';
import { FormRadio } from './FormRadio';
import { FormRadioGroup } from './FormRadioGroup';
import { FormSelect } from './FormSelect';
import { FormSwitch } from './FormSwitch';
import { FormTextarea } from './FormTextarea';

/* eslint @typescript-eslint/no-unsafe-member-access: "off" */

const Base: any = BaseForm;
Base.Item = FormItem;
Base.Input = FormInput;
Base.Textarea = FormTextarea;
Base.CheckBox = FormCheckBox;
Base.Switch = FormSwitch;
Base.Radio = FormRadio;
Base.RadioGroup = FormRadioGroup;
Base.Select = FormSelect;

type IFormComponentType = typeof BaseForm & {
  Item: typeof FormItem;
  Input: typeof FormInput;
  Textarea: typeof FormTextarea;
  CheckBox: typeof FormCheckBox;
  Switch: typeof FormSwitch;
  Radio: typeof FormRadio;
  RadioGroup: typeof FormRadioGroup;
  Select: typeof FormSelect;
};

const Form = Base as IFormComponentType;
export default Form;
