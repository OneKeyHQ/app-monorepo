import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRemovePeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.614 6.542a4.462 4.462 0 1 1 8.924 0 4.462 4.462 0 0 1-8.924 0m4.462 5.454c-4.718 0-8.015 3.491-8.424 7.84a.99.99 0 0 0 .987 1.084h8.438a2.97 2.97 0 0 1 .741-2.975 2.975 2.975 0 0 1 2.08-5.078c-1.12-.557-2.407-.871-3.822-.871m4.667 3.264a.992.992 0 0 0-1.402 1.403l1.282 1.282-1.282 1.282a.991.991 0 1 0 1.402 1.402l1.282-1.282 1.282 1.282a.991.991 0 1 0 1.403-1.402l-1.282-1.282 1.282-1.282a.992.992 0 0 0-1.403-1.402l-1.282 1.282z" />
  </Svg>
);
export default SvgRemovePeople;
