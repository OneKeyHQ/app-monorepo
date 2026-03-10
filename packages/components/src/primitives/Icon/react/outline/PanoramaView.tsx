import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPanoramaView = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23 19H1V5h22zM3 17h18V7H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPanoramaView;
