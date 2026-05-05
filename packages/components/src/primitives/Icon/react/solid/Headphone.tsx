import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHeadphone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 3v.055A9 9 0 0 1 21 12v9h-6v-8h4v-1a7 7 0 1 0-14 0v1h4v8H3v-9a9 9 0 0 1 9-9z" />
  </Svg>
);
export default SvgHeadphone;
