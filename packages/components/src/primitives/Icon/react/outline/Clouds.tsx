import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClouds = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 3a5 5 0 0 1 4.6 6.959A5.5 5.5 0 0 1 16.5 20H9a7 7 0 1 1 1.36-13.866A5 5 0 0 1 15 3M9 8a5 5 0 0 0 0 10h7.5a3.5 3.5 0 1 0-1.592-6.618l-.928.475-.436-.947a5.02 5.02 0 0 0-2.835-2.61A5 5 0 0 0 9 8m6-3a3 3 0 0 0-2.75 1.8 7 7 0 0 1 2.651 2.436 5.5 5.5 0 0 1 2.87-.087A3 3 0 0 0 15 5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClouds;
