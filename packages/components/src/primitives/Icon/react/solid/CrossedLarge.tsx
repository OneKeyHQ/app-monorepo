import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrossedLarge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4.19 4.19a1.5 1.5 0 0 1 2.12 0L12 9.878l5.69-5.69a1.5 1.5 0 0 1 2.12 2.122L14.122 12l5.69 5.69a1.5 1.5 0 0 1-2.122 2.12L12 14.122l-5.69 5.69a1.5 1.5 0 0 1-2.12-2.122L9.878 12l-5.69-5.69a1.5 1.5 0 0 1 0-2.12Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCrossedLarge;
