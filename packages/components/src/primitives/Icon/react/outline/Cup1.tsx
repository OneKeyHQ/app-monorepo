import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCup1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17 6h4v8h-4v7H3V3h14zM5 19h10V5H5zm12-7h2V8h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCup1;
