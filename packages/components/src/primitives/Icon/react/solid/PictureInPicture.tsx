import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPictureInPicture = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5a1 1 0 1 0 0-2H4V6h14v5a1 1 0 1 0 2 0V6a2 2 0 0 0-2-2z" />
    <Path d="M13.5 14a1.5 1.5 0 0 0-1.5 1.5v4a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 0-1.5-1.5z" />
  </Svg>
);
export default SvgPictureInPicture;
