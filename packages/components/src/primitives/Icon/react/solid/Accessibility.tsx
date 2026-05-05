import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAccessibility = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m3.442 7.68c-1.14.16-2.29.32-3.44.32s-2.3-.16-3.441-.32l-.414-.057-.272 1.982c1.028.14 2.053.28 3.09.353a5.2 5.2 0 0 1-.32 1.404c-.254.65-.67 1.266-1.342 1.923l-.715.698 1.397 1.431.716-.7a8.2 8.2 0 0 0 1.342-1.672c.316.561.72 1.105 1.234 1.647l.689.725 1.45-1.378-.69-.726c-.976-1.027-1.43-2.036-1.625-3.356 1.015-.073 2.02-.211 3.028-.35l-.273-1.981zM12 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAccessibility;
