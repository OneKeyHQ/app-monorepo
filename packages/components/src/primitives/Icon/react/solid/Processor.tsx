import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgProcessor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 9.999a2.001 2.001 0 1 1 0 4.002 2.001 2.001 0 0 1 0-4.002" />
    <Path
      fillRule="evenodd"
      d="M9 1.996V4h2V1.996h2V4h2V2h2v2h3v3h2v2h-2v2h2v2h-2v2h2v2h-2v3h-3v2h-2v-2h-2v2h-2v-2H9v2H7v-2H4v-3H2v-2h2v-2H2v-2h2V9H2V7h2V4h3V1.996zM12 8a4.001 4.001 0 1 0 0 8.002A4.001 4.001 0 0 0 12 8"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgProcessor;
