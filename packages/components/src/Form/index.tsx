import { Form as BaseForm } from './Form';
import { FormCheckBox } from './FormCheckBox';
import { FormErrorMessage } from './FormErrorMessage';
import { FormInput } from './FormInput';
import { FormItem } from './FormItem';
import { FormNumberInput } from './FormNumberInput';
import { FormPasswordInput } from './FormPasswordInput';
import { FormRadio } from './FormRadio';
import { FormRadioGroup } from './FormRadioGroup';
import { FormSegmentedControl } from './FormSegmentedControl';
import { FormSelect } from './FormSelect';
import { FormSwitch } from './FormSwitch';
import { FormTextarea } from './FormTextarea';

/* eslint @typescript-eslint/no-unsafe-member-access: "off" */

const Base: any = BaseForm;
Base.Item = FormItem;
Base.Input = FormInput;
Base.NumberInput = FormNumberInput;
Base.Textarea = FormTextarea;
Base.CheckBox = FormCheckBox;
Base.Switch = FormSwitch;
Base.Radio = FormRadio;
Base.RadioGroup = FormRadioGroup;
Base.Select = FormSelect;
Base.PasswordInput = FormPasswordInput;
Base.FormErrorMessage = FormErrorMessage;
Base.SegmentedControl = FormSegmentedControl;

type IFormComponentType = typeof BaseForm & {
  Item: typeof FormItem;
  Input: typeof FormInput;
  NumberInput: typeof FormNumberInput;
  Textarea: typeof FormTextarea;
  CheckBox: typeof FormCheckBox;
  Switch: typeof FormSwitch;
  Radio: typeof FormRadio;
  RadioGroup: typeof FormRadioGroup;
  Select: typeof FormSelect;
  PasswordInput: typeof FormPasswordInput;
  FormErrorMessage: typeof FormErrorMessage;
  SegmentedControl: typeof FormSegmentedControl;
};

const Form = Base as IFormComponentType;
export default Form;
