import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddRow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.5 9.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1m4.5-.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1m4.5-.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M22.002 19.036h-6.627l-3.38 2.802-3.343-2.802h-6.65V3h20zm-18-2h5.377L12 19.233l2.377-1.967.278-.23h5.347V5h-16z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddRow;
