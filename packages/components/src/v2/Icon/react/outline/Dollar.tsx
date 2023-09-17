import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDollar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.356 9.199a1 1 0 0 0 1.747-.974l-1.747.974ZM12 12.012l-.321.947.321-.947Zm-1.356 2.814a1 1 0 0 0-1.747.973l1.747-.973ZM13 5.999a1 1 0 1 0-2 0h2ZM11 18a1 1 0 1 0 2 0h-2Zm1-11.5c-.866 0-1.737.194-2.412.727-.713.561-1.075 1.395-1.075 2.374h2c0-.457.148-.674.313-.804C11.027 8.64 11.4 8.5 12 8.5v-2Zm3.103 1.725C14.521 7.181 13.403 6.5 12 6.5v2c.718 0 1.146.322 1.356.699l1.747-.974Zm-6.59 1.376c0 1.144.471 1.94 1.193 2.472.625.46 1.43.702 1.973.886l.642-1.894c-.677-.23-1.115-.37-1.43-.602-.216-.16-.378-.361-.378-.862h-2ZM12 17.525c.866 0 1.737-.194 2.412-.727.713-.562 1.075-1.395 1.075-2.374h-2c0 .457-.148.674-.313.803-.201.16-.574.298-1.174.298v2Zm-3.103-1.726c.582 1.045 1.7 1.726 3.103 1.726v-2c-.718 0-1.146-.322-1.356-.699l-1.747.973Zm6.59-1.375c0-1.144-.471-1.941-1.193-2.473-.625-.46-1.43-.702-1.973-.886l-.642 1.894c.677.23 1.115.372 1.43.603.216.159.378.361.378.862h2ZM13 7.5V6h-2v1.5h2Zm-2 9.025V18h2v-1.475h-2ZM20 12a8 8 0 0 1-8 8v2c5.523 0 10-4.477 10-10h-2Zm-8 8a8 8 0 0 1-8-8H2c0 5.523 4.477 10 10 10v-2Zm-8-8a8 8 0 0 1 8-8V2C6.477 2 2 6.477 2 12h2Zm8-8a8 8 0 0 1 8 8h2c0-5.523-4.477-10-10-10v2Z"
    />
  </Svg>
);
export default SvgDollar;
