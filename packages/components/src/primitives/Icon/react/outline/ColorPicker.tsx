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
      d="m22.414 7-5.5 5.5 1.5 1.5L17 15.414l-1.5-1.5L8.414 21H3v-5.414L10.086 8.5 8.586 7 10 5.586l1.5 1.5 5.5-5.5zM5 16.414V19h2.586l6.5-6.5L11.5 9.914zM12.914 8.5l2.586 2.586L19.586 7 17 4.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorPicker;
