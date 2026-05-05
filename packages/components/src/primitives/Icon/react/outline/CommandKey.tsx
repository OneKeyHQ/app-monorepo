import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCommandKey = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 8.5a2.5 2.5 0 0 1-2.5 2.5H15v2h.5a2.5 2.5 0 1 1-2.5 2.5V15h-2v.5A2.5 2.5 0 1 1 8.5 13H9v-2h-.5A2.5 2.5 0 1 1 11 8.5V9h2v-.5a2.5 2.5 0 0 1 5 0M9 15h-.5a.5.5 0 1 0 .5.5zm7 .5a.5.5 0 0 0-.5-.5H15v.5a.5.5 0 0 0 1 0M11 13h2v-2h-2zM9 8.5a.5.5 0 1 0-.5.5H9zm7 0a.5.5 0 0 0-1 0V9h.5a.5.5 0 0 0 .5-.5"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCommandKey;
