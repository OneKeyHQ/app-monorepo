import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShieldExclamation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.352 2.224c.42-.145.876-.145 1.296 0l6.98 2.4a1.99 1.99 0 0 1 1.347 1.885v5.434c0 2.798-1.146 4.815-2.805 6.385-1.568 1.485-3.622 2.592-5.54 3.626l-.156.085a1 1 0 0 1-.948 0l-.156-.085c-1.918-1.034-3.972-2.141-5.54-3.626-1.659-1.57-2.804-3.587-2.805-6.385V6.509c0-.852.542-1.61 1.347-1.886zM12 12.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m0-4.75a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShieldExclamation;
