import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShield = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.649 2.224a2 2 0 0 0-1.297 0l-6.98 2.399a1.99 1.99 0 0 0-1.346 1.886v5.433c0 2.799 1.146 4.816 2.804 6.386 1.568 1.485 3.622 2.592 5.54 3.626l.157.085c.295.16.651.16.947 0l.156-.085c1.918-1.034 3.972-2.142 5.54-3.626 1.659-1.57 2.804-3.587 2.804-6.386V6.509c0-.852-.54-1.61-1.346-1.886l-6.98-2.4Z" />
  </Svg>
);
export default SvgShield;
