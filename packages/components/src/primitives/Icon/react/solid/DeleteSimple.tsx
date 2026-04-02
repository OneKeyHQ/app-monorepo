import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDeleteSimple = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 1.5A5 5 0 0 1 16.77 5h4.73v2h-1.532l-1.034 15H5.066L4.032 7H2.5V5h4.73A5 5 0 0 1 12 1.5m0 2A3 3 0 0 0 9.401 5H14.6A3 3 0 0 0 12 3.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDeleteSimple;
