import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLookGlasses = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 7c1.636 0 3.088.786 4 2h2v2h-1.1a5 5 0 1 1-9.601-.704 3 3 0 0 0-1.3-.296c-.466 0-.906.106-1.299.295A5 5 0 1 1 1.1 11H0V9h2a5 5 0 0 1 4-2c1.442 0 2.74.61 3.652 1.587a4.98 4.98 0 0 1 4.695 0A4.99 4.99 0 0 1 18 7M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m12 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLookGlasses;
