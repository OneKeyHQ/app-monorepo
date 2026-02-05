import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCc = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.957 11.293a1 1 0 1 0 0 1.414 1 1 0 0 1 1.414 1.414 3 3 0 1 1 0-4.242 1 1 0 0 1-1.414 1.414m-6.331-.22a1 1 0 1 0 .331 1.634 1 1 0 0 1 1.414 1.414 3 3 0 1 1 0-4.242 1 1 0 0 1-1.414 1.414 1 1 0 0 0-.331-.22"
      clipRule="evenodd"
    />
    <Path d="M5 5v14h14V5zm16 14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCc;
