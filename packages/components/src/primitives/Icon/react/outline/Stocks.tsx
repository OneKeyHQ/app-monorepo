import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStocks = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 10a1 1 0 1 0-2 0 1 1 0 0 0 2 0m-2 9v-6.175a3 3 0 0 1-.291-.12l-3.002 3.002a1 1 0 0 1-1.414 0L7 14.414l-1.793 1.793a1 1 0 0 1-.207.157V19zm4-9a3 3 0 0 1-2 2.825V19h4V5h-4v2.174c1.165.412 2 1.52 2 2.826M5 13.586l1.293-1.293.076-.068a1 1 0 0 1 1.338.068L9 13.586l2.295-2.296A3 3 0 0 1 11 10c0-1.306.835-2.414 2-2.826V5H5zM21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgStocks;
