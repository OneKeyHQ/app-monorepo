import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCut2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 3a4 4 0 0 1 2.935 6.719l2.064.854V7.86l7.655-3.533 4.757 3.964L14.448 12l8.963 3.709-4.757 3.964L11 16.14v-2.713l-2.064.854a4 4 0 1 1-2.268-1.226L9.217 12l-2.55-1.056A4 4 0 1 1 6 3m0 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4M6 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCut2;
