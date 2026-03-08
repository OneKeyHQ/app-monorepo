import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiImages = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.5 8.5 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 16.414V19h8.586L8 13.414zm0-2.828 3-3L16.414 19H19V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAiImages;
