import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 13h5.204L12 23.519 2.796 13H8V2h8zm-6 2H7.204L12 20.48 16.796 15H14V4h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowPathDown;
