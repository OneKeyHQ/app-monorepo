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
      d="M22.506 11.066C19.973 6.503 16.049 4.092 12 4.092c-4.048 0-7.972 2.411-10.505 6.974a1.93 1.93 0 0 0 0 1.868C4.028 17.497 7.952 19.908 12 19.908s7.973-2.412 10.506-6.974a1.93 1.93 0 0 0 0-1.868M11.557 8.93l-.802 1.605a.5.5 0 0 1-.22.22l-1.605.803a.494.494 0 0 0 0 .884l1.604.802a.5.5 0 0 1 .221.221l.802 1.605a.494.494 0 0 0 .885 0l.802-1.605a.5.5 0 0 1 .22-.22l1.605-.803a.494.494 0 0 0 0-.884l-1.604-.802a.5.5 0 0 1-.221-.221l-.802-1.605a.494.494 0 0 0-.885 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicEye;
