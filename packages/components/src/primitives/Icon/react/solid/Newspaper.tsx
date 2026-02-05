import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNewspaper = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 11V9h3v2z" />
    <Path
      fillRule="evenodd"
      d="M2 5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v6h3a2 2 0 0 1 2 2v4.5a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5zm16.5 14a1.5 1.5 0 0 0 1.5-1.5V13h-3v4.5a1.5 1.5 0 0 0 1.5 1.5M6 16a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1m1-9a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNewspaper;
