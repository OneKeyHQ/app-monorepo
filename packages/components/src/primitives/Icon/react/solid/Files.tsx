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
      d="M14 7a2 2 0 0 0 2 2h5v8a2 2 0 0 1-2 2h-1v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a2 2 0 0 1 2-2h5zM6 20h10v-1H9a2 2 0 0 1-2-2V7H6z"
      clipRule="evenodd"
    />
    <Path d="M20.414 7H16V2.586z" />
  </Svg>
);
export default SvgFiles;
