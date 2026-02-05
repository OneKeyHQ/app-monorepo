import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAr = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4.624a2 2 0 0 0 1.317-.495L12 16.83l3.059 2.676a2 2 0 0 0 1.317.495H21a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm4.5 4.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5m6.75 2.25a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAr;
