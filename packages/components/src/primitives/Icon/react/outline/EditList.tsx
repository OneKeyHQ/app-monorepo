import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEditList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.414 11.865 12.28 22H7v-5.28L17.135 6.587l5.28 5.28ZM9 17.55V20h2.451l8.135-8.135-2.451-2.45L9 17.548Z"
      clipRule="evenodd"
    />
    <Path d="M8.002 13H3v-2h5.002zM11.5 9H3V7h8.5zM21 5H3V3h18z" />
  </Svg>
);
export default SvgEditList;
