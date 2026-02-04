import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoin2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10M10.94 9.06l-1.88 1.88a1.5 1.5 0 0 0 0 2.12l1.88 1.88a1.5 1.5 0 0 0 2.12 0l1.88-1.88a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoin2;
