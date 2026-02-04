import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTruck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 4a2 2 0 0 0-2 2H5.535a2 2 0 0 0-1.664.89L2.336 9.194A2 2 0 0 0 2 10.303V15a2 2 0 0 0 2 2h.035a3.5 3.5 0 0 0 6.93 0h2.07a3.501 3.501 0 0 0 6.93 0H20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm6.5 11a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M8 13.035V8H5.535L4 10.303V15h.337A3.5 3.5 0 0 1 8 13.035M6 16.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTruck;
