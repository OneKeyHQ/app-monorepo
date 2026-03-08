import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCamera = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0m-2 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="m15.035 3 2 3H22v15H2V6h4.965l2-3zm-7 5H4v11h16V8h-4.035l-2-3h-3.93z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCamera;
