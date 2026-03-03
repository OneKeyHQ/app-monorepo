import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImageSquareMountain = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM8.687 13.065a1 1 0 0 0-1.272-.16l-2.39 1.787-.025.019V19h14v-3.646c-1.12.701-2.394 1.1-4 1.1-2.81 0-4.796-1.755-6.313-3.389M5 12.213l1.246-.932.022-.016.022-.015a3 3 0 0 1 3.862.455c1.468 1.581 2.942 2.75 4.848 2.75 1.657 0 2.779-.527 3.87-1.5l.13-.117V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageSquareMountain;
