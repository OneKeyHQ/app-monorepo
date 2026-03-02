import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShieldExclamation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 12.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0-4.75a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M11.352 2.223c.42-.145.876-.145 1.296 0l6.98 2.4a1.995 1.995 0 0 1 1.347 1.886v5.432c0 2.799-1.146 4.817-2.805 6.387-1.61 1.525-3.735 2.652-5.696 3.71a1 1 0 0 1-.947 0c-1.961-1.058-4.086-2.185-5.697-3.71-1.659-1.57-2.805-3.588-2.805-6.386V6.508c0-.852.542-1.61 1.347-1.887l6.98-2.4ZM5.02 6.509v5.432c0 2.16.848 3.676 2.18 4.938 1.272 1.204 2.957 2.149 4.799 3.145 1.842-.996 3.527-1.94 4.799-3.145 1.332-1.262 2.181-2.778 2.181-4.938V6.51L12 4.109z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShieldExclamation;
