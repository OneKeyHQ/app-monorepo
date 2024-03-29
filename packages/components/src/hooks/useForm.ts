import { useForm as useFromFunc } from 'react-hook-form';

export const useForm: typeof useFromFunc = (props) =>
  useFromFunc({
    ...props,
    mode: props?.mode || 'onBlur',
  });
export {
  useFormContext,
  useFormState,
  useWatch as useFormWatch,
} from 'react-hook-form';
