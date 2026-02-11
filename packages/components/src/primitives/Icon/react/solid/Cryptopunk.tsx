import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCryptopunk = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4h2a1 1 0 1 1 0 2h-2v8a4 4 0 0 1-4 4h-3v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6.17a3.001 3.001 0 0 1 0-5.66zm2 0h10a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2m3 4a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H11a1 1 0 0 1-1-1m4 0a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H15a1 1 0 0 1-1-1m-2.088 4.105c.4.12.957.147 1.845-.075a1 1 0 1 1 .486 1.94c-1.112.278-2.055.305-2.905.05s-1.489-.757-2.045-1.313a1 1 0 1 1 1.414-1.414c.444.444.805.692 1.205.812"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCryptopunk;
