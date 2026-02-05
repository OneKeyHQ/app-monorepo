import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBnoozeBell = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4.702 8.943a7.307 7.307 0 0 1 14.596 0l.19 3.798 1.321 2.641A1.81 1.81 0 0 1 19.191 18H16.9a5.002 5.002 0 0 1-9.8 0H4.809a1.81 1.81 0 0 1-1.618-2.618l1.32-2.641zM9.17 18a3.001 3.001 0 0 0 5.658 0zM10.5 7.5a1 1 0 0 0 0 2h1l-1.8 2.4a1 1 0 0 0 .8 1.6h3a1 1 0 1 0 0-2h-1l1.8-2.4a1 1 0 0 0-.8-1.6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBnoozeBell;
