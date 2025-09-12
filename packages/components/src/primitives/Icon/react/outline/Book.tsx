import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBook = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 6a1 1 0 0 0 0 2zm6 2a1 1 0 1 0 0-2zm-6 2a1 1 0 1 0 0 2zm3 2a1 1 0 1 0 0-2zM7 4h10V2H7zm11 1v14h2V5zm-1 15H7v2h10zM6 19V5H4v14zm1 1a1 1 0 0 1-1-1H4a3 3 0 0 0 3 3zm11-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zM17 4a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1zm11 10v3h2v-3zm-1 4H7v2h10zM7 22h3v-2H7zm0-6a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1zm11-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zM9 8h6V6H9zm0 4h3v-2H9z"
    />
  </Svg>
);
export default SvgBook;
