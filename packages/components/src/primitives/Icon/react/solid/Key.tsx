import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKey = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7 6c2.009 0 3.786.988 4.874 2.5h9.106l2.8 3.5-2.8 3.5h-3.216L16 14.618l-1.764.882h-2.362A6 6 0 1 1 7 6m0 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKey;
