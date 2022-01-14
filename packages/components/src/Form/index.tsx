import { Form as BaseForm } from './Form';
import { FormCheckBox } from './FormCheckBox';
import { FormInput } from './FormInput';
import { FormItem } from './FormItem';
import { FormPasswordInput } from './FormPasswordInput';
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
Base.PasswordInput = FormPasswordInput;

type IFormComponentType = typeof BaseForm & {
  Item: typeof FormItem;
  Input: typeof FormInput;
  Textarea: typeof FormTextarea;
  CheckBox: typeof FormCheckBox;
  Switch: typeof FormSwitch;
  Radio: typeof FormRadio;
  RadioGroup: typeof FormRadioGroup;
  Select: typeof FormSelect;
  PasswordInput: typeof FormPasswordInput;
};

const Form = Base as IFormComponentType;
export default Form;
