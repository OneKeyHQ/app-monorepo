/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import RadioBoxItem from './RadioBox';
import RadioBoxGroup from './RadioBoxGroup';

const RadioBoxTemp: any = RadioBoxItem;
RadioBoxTemp.Group = RadioBoxGroup;

type IRadioBoxComponentType = typeof RadioBoxItem & {
  Group: typeof RadioBoxGroup;
};

const RadioBox = RadioBoxTemp as IRadioBoxComponentType;

export default RadioBox;
