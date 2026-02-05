import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.293 3.293a1 1 0 0 1 1.414 0L9 7.586V5a1 1 0 0 1 2 0v4.5A1.5 1.5 0 0 1 9.5 11H5a1 1 0 1 1 0-2h2.586L3.293 4.707a1 1 0 0 1 0-1.414M13 7a1 1 0 0 1 1-1h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a1 1 0 1 1 2 0v6h12V8h-6a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDock;
