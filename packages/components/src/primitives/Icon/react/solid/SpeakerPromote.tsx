import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeakerPromote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.996 7.126a4.002 4.002 0 0 1 0 7.747v5.496l-5.36-1.707A4.001 4.001 0 0 1 5.996 17v-.779l-4-1.276v-7.89l4.002-1.277v-.009l12.998-4.138zM7.996 17a2 2 0 0 0 3.705 1.046l-3.705-1.18zm-4-8.484v4.968l2.002.639V7.877zm15 4.217a2 2 0 0 0 0-3.465z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeakerPromote;
