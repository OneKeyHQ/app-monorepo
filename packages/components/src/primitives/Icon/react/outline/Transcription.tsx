import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTranscription = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 6v12h16V6zm7 8a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm6 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm-9-4a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm9 0a1 1 0 1 1 0 2h-5a1 1 0 1 1 0-2zm5 8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgTranscription;
