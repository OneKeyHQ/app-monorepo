import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlaceholder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h1a1 1 0 0 1 0 2H5v1a1 1 0 0 1-2 0zm6.5-1a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1M17 4a1 1 0 0 1 1-1h1a2 2 0 0 1 2 2v1a1 1 0 1 1-2 0V5h-1a1 1 0 0 1-1-1M4 9.5a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1m16 0a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1M4 17a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2v-1a1 1 0 0 1 1-1m16 0a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2h-1a1 1 0 1 1 0-2h1v-1a1 1 0 0 1 1-1M9.5 20a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPlaceholder;
