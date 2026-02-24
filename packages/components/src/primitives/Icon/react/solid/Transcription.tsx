import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTranscription = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM6 14v2h7v-2zm9 0v2h3v-2zm-9-2h3v-2H6zm5 0h7v-2h-7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTranscription;
