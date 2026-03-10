import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImageWave = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 5v7.214l1.268-.95.022-.014a3 3 0 0 1 3.862.455c1.468 1.581 2.942 2.75 4.848 2.75 1.704 0 2.855-.557 4-1.62V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageWave;
