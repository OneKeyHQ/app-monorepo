import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPiano = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 3a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm1.5 2H5v15h3v-6h-.5a1 1 0 0 1-1-1zM10 20h4v-6h-.5a1 1 0 0 1-1-1V5h-1v8a1 1 0 0 1-1 1H10zm7.5-15v8a1 1 0 0 1-1 1H16v6h3V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPiano;
