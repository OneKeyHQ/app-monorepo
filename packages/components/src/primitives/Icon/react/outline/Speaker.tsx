import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeaker = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10 6a1 1 0 0 0 0 2zm4 2a1 1 0 1 0 0-2zM7 4h10V2H7zm11 1v14h2V5zm-1 15H7v2h10zM6 19V5H4v14zm1 1a1 1 0 0 1-1-1H4a3 3 0 0 0 3 3zm11-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zM17 4a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1zm7 12a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4zm-2 2a2 2 0 0 1-2-2H8a4 4 0 0 0 4 4zm-2-2a2 2 0 0 1 2-2v-2a4 4 0 0 0-4 4zm2-2a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4zm-2-4h4V6h-4z"
    />
  </Svg>
);
export default SvgSpeaker;
