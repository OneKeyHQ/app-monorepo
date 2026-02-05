import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.237 12c2.253 4.04 5.57 5.93 8.763 5.93s6.51-1.89 8.763-5.93C18.51 7.96 15.193 6.07 12 6.07S5.49 7.96 3.237 12M12 4.092c4.048 0 7.972 2.411 10.505 6.974a1.93 1.93 0 0 1 0 1.868c-2.533 4.563-6.457 6.974-10.505 6.974s-7.972-2.411-10.505-6.974a1.93 1.93 0 0 1 0-1.868C4.028 6.503 7.952 4.092 12 4.092"
      clipRule="evenodd"
    />
    <Path d="m10.756 10.535.802-1.605a.494.494 0 0 1 .884 0l.802 1.605a.5.5 0 0 0 .221.22l1.605.803a.494.494 0 0 1 0 .884l-1.605.802a.5.5 0 0 0-.22.221l-.803 1.605a.494.494 0 0 1-.884 0l-.802-1.605a.5.5 0 0 0-.221-.22l-1.605-.803a.494.494 0 0 1 0-.884l1.605-.802a.5.5 0 0 0 .22-.221Z" />
  </Svg>
);
export default SvgMagicEye;
