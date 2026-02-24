import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAr = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.5 8.75a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5m0 2a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5m9-2a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5m0 2a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M23 20h-7.376L12 16.828 8.376 20H1V5h22zM3 18h4.624L12 14.17 16.376 18H21V7H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAr;
