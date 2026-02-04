import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRandomCrossover = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.293 3.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L18.586 8h-2.172L6 18.414A2 2 0 0 1 4.586 19H3a1 1 0 1 1 0-2h1.586L15 6.586A2 2 0 0 1 16.414 6h2.172l-1.293-1.293a1 1 0 0 1 0-1.414M2 6a1 1 0 0 1 1-1h1.586A2 2 0 0 1 6 5.586l2.707 2.707a1 1 0 0 1-1.414 1.414L4.586 7H3a1 1 0 0 1-1-1m15.293 7.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L18.586 18h-2.172A2 2 0 0 1 15 17.414l-1.707-1.707a1 1 0 0 1 1.414-1.414L16.414 16h2.172l-1.293-1.293a1 1 0 0 1 0-1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRandomCrossover;
