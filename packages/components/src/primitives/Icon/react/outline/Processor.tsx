import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgProcessor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 7.999a4 4 0 1 1 0 8.002 4 4 0 0 1 0-8.002m0 2a2 2 0 1 0 0 4.002 2 2 0 0 0 0-4.002"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M9 4h2V1.996h2V4h2V2h2v2h3v3h2v2h-2v2h2v2h-2v2h2v2h-2v3h-3v2h-2v-2h-2v2h-2v-2H9v1.999H7V20H4v-3H2v-2h2v-2H2v-2h2V9H2V7h2V4h3V1.996h2zM6 18h12V6H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgProcessor;
