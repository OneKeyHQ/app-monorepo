import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStocks = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM9 16.414l-2-2-2 2V19h8v-6.175a3 3 0 0 1-.291-.12zm6-9.24a2.998 2.998 0 0 1 0 5.651V19h4V5h-4zM5 13.586l2-2 2 2 2.295-2.296A3 3 0 0 1 11 10c0-1.306.835-2.414 2-2.826V5H5zM14 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStocks;
