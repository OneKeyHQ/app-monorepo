import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBold = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 5.875C5 4.38 6.178 3 7.833 3h5c3.037 0 5.334 2.556 5.334 5.5a5.63 5.63 0 0 1-.855 2.984A5.6 5.6 0 0 1 19 15.5c0 2.945-2.297 5.5-5.333 5.5H7.833C6.178 21 5 19.62 5 18.125zM12.833 10c.646 0 1.334-.579 1.334-1.5S13.479 7 12.833 7H9v3zM9 14h4.667c.645 0 1.333.579 1.333 1.5 0 .922-.688 1.5-1.333 1.5H9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBold;
