import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCommandKey = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 15.5a.5.5 0 1 1-.5-.5H9zm6.5-.5a.5.5 0 1 1-.5.5V15zM13 13h-2v-2h2zM8.5 8a.5.5 0 0 1 .5.5V9h-.5a.5.5 0 0 1 0-1m7 0a.5.5 0 0 1 0 1H15v-.5a.5.5 0 0 1 .5-.5" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM15.5 6A2.5 2.5 0 0 0 13 8.5V9h-2v-.5A2.5 2.5 0 1 0 8.5 11H9v2h-.5a2.5 2.5 0 1 0 2.5 2.5V15h2v.5a2.5 2.5 0 1 0 2.5-2.5H15v-2h.5a2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCommandKey;
