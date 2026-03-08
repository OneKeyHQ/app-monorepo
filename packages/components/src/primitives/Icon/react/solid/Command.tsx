import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCommand = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.5 3a3.5 3.5 0 1 1 0 7H16v4h1.5a3.5 3.5 0 1 1-3.5 3.5V16h-4v1.5A3.5 3.5 0 1 1 6.5 14H8v-4H6.5A3.5 3.5 0 1 1 10 6.5V8h4V6.5A3.5 3.5 0 0 1 17.5 3m-11 13A1.5 1.5 0 1 0 8 17.5V16zm9.5 1.5a1.5 1.5 0 1 0 1.5-1.5H16zM10 14h4v-4h-4zM6.5 5a1.5 1.5 0 1 0 0 3H8V6.5A1.5 1.5 0 0 0 6.5 5m11 0A1.5 1.5 0 0 0 16 6.5V8h1.5a1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCommand;
