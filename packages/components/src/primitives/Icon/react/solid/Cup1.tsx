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
      d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm14 8h2V8h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCup1;
