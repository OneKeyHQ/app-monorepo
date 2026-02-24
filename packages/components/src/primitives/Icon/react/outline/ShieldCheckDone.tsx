import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShieldCheckDone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.914 9.75 11 14.664 8.086 11.75 9.5 10.336l1.5 1.5 3.5-3.5z" />
    <Path
      fillRule="evenodd"
      d="M12.325 2.055 21 5.036v6.876c0 2.807-1.149 4.83-2.813 6.404-1.615 1.53-3.745 2.66-5.712 3.722l-.475.256-.475-.256c-1.967-1.061-4.097-2.192-5.713-3.722C4.15 16.741 3 14.72 3 11.912V5.036l8.675-2.981.325-.113zM5 6.463v5.45c0 2.165.851 3.686 2.188 4.951 1.275 1.208 2.965 2.154 4.812 3.154 1.847-1 3.537-1.946 4.813-3.154C18.148 15.6 19 14.078 19 11.912v-5.45l-7-2.405z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShieldCheckDone;
