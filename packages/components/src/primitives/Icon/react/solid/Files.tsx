import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFiles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14 9h7v10h-3v3H4V5h3V2h7zM6 20h10v-1H7V7H6z"
      clipRule="evenodd"
    />
    <Path d="M20.414 7H16V2.586z" />
  </Svg>
);
export default SvgFiles;
