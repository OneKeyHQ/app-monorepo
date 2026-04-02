import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTape = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13.379 9.879A3 3 0 1 1 15.5 15h-7a3 3 0 1 1 2.825-2h1.35a3 3 0 0 1 .704-3.121m-4.172 1.414a1 1 0 1 0-1.414 1.414 1 1 0 0 0 1.414-1.414m7 0a1 1 0 1 0-1.414 1.414l.076.068a1 1 0 0 0 1.338-1.482"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M23 20H1V4h22zM3 18h18V6H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTape;
