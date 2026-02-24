import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColorPicker = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m22.414 7-5.5 5.5 1.5 1.5L17 15.414l-1.5-1.5L8.414 21H3v-5.414L10.086 8.5 8.586 7 10 5.586l1.5 1.5 5.5-5.5zm-16 8h5.172l2.5-2.5L11.5 9.914z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorPicker;
