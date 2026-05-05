import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHotSpot = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 14.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"
      clipRule="evenodd"
    />
    <Path d="M12 10.75c1.22 0 2.446.391 3.459 1.18l-1.23 1.579A3.62 3.62 0 0 0 12 12.75a3.62 3.62 0 0 0-2.229.758l-1.229-1.576A5.62 5.62 0 0 1 12 10.75M12 7c1.94 0 3.885.623 5.49 1.876l-1.23 1.576A6.9 6.9 0 0 0 12 9a6.9 6.9 0 0 0-4.26 1.452L6.51 8.876A8.9 8.9 0 0 1 12 7" />
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHotSpot;
