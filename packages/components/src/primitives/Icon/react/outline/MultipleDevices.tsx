import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMultipleDevices = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 16v-1a1 1 0 0 0-1 1zm11 1h1v-2h-1zm0 4h1v-2h-1zm4-4a1 1 0 1 0 0 2zm1 2a1 1 0 1 0 0-2zM6 5h12V3H6zM5 16V6H3v10zm-3 1h2v-2H2zm2 0h9v-2H4zm9 2H4v2h9zM3 18v-2H1v2zM19 6v3h2V6zM4 19a1 1 0 0 1-1-1H1a3 3 0 0 0 3 3zM18 5a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zM6 3a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1zm9 7h5V8h-5zm6 1v8h2v-8zm-1 9h-5v2h5zm-6-1v-8h-2v8zm3 0h1v-2h-1zm-2 1a1 1 0 0 1-1-1h-2a3 3 0 0 0 3 3zm6-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zm-1-9a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zm-5-2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1z"
    />
  </Svg>
);
export default SvgMultipleDevices;
