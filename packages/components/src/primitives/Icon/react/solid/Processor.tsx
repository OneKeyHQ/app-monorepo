import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgProcessor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 9.999a2.001 2.001 0 1 0 0 4.003 2.001 2.001 0 0 0 0-4.003" />
    <Path
      fillRule="evenodd"
      d="M9 2.996a1 1 0 0 0-2 0V4H6a2 2 0 0 0-2 2v1H3a1 1 0 0 0 0 2h1v2H3a1 1 0 1 0 0 2h1v2H3a1 1 0 1 0 0 2h1v1a2 2 0 0 0 2 2h1v1a1 1 0 1 0 2 0v-1h2v1a1 1 0 1 0 2 0v-1h2v1a1 1 0 1 0 2 0v-1h1a2 2 0 0 0 2-2v-1h1a1 1 0 1 0 0-2h-1v-2h1a1 1 0 1 0 0-2h-1V9h1a1 1 0 1 0 0-2h-1V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1h-2V2.996a1 1 0 1 0-2 0V4H9zM7.999 12A4.001 4.001 0 1 1 16 12a4.001 4.001 0 0 1-8 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgProcessor;
