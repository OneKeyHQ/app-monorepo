import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShieldCheckDone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.352 2.224c.42-.145.876-.145 1.296 0l6.98 2.399a1.99 1.99 0 0 1 1.346 1.886v5.433c0 2.799-1.145 4.816-2.804 6.386-1.568 1.485-3.622 2.592-5.54 3.626l-.156.085a1 1 0 0 1-.947 0l-.157-.085c-1.918-1.034-3.972-2.142-5.54-3.626-1.659-1.57-2.804-3.587-2.804-6.386V6.509c0-.852.54-1.61 1.346-1.886zm3.846 8.267a.997.997 0 1 0-1.41-1.41l-2.785 2.785-.79-.791a.997.997 0 0 0-1.41 1.41l1.495 1.496a.997.997 0 0 0 1.41 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShieldCheckDone;
