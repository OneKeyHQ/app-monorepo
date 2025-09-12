import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTypeC = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M0 12a6 6 0 0 1 6-6h12a6 6 0 0 1 0 12H6a6 6 0 0 1-6-6m6-1a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTypeC;
