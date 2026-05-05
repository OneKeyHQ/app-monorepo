import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlay = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.97 12 5 22V2zM7 18.5 18.03 12 7 5.499z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPlay;
