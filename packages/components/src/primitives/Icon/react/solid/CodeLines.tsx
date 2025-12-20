import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeLines = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 5a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1m15 0a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1M2 12a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1m10 0a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2h-8a1 1 0 0 1-1-1M2 19a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1m12 0a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCodeLines;
