import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTranscription = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3zm4 8a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1m9 0a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1m-8-5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2zm5 0a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTranscription;
