import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPiano = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3a3 3 0 0 0-3 3v13a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zm.5 2H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h2v-6h-.5a1 1 0 0 1-1-1zM10 20h4v-6h-.5a1 1 0 0 1-1-1V5h-1v8a1 1 0 0 1-1 1H10zm7.5-15v8a1 1 0 0 1-1 1H16v6h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPiano;
