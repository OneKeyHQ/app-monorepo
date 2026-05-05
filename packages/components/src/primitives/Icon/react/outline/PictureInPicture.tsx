import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPictureInPicture = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 21H12v-7h10zm-8-2h6v-3h-6z"
      clipRule="evenodd"
    />
    <Path d="M20 12h-2V6H4v10h6v2H2V4h18z" />
  </Svg>
);
export default SvgPictureInPicture;
