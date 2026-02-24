import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPictureInPicture = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 14v7H12v-7z" />
    <Path d="M20 4v8h-2V6H4v10h6v2H2V4z" />
  </Svg>
);
export default SvgPictureInPicture;
