import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCarussel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3zm0 3H4v10h2zm12 10h2V7h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCarussel;
