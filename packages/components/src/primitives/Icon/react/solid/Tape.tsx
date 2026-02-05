import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTape = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0m10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
    <Path
      fillRule="evenodd"
      d="M1 6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2zm10 6c0 .35-.06.687-.17 1h2.34A3 3 0 1 1 16 15H8a3 3 0 1 1 3-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTape;
