import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallBasket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 13v8.95a9.96 9.96 0 0 1-5.5-2.35A9.98 9.98 0 0 0 8.95 13zm4.05 0a9.98 9.98 0 0 0 3.45 6.6 9.96 9.96 0 0 1-5.5 2.35V13zm-8.11 0a8 8 0 0 1-2.824 5.15A9.95 9.95 0 0 1 2.051 13h4.888Zm15.011 0a9.95 9.95 0 0 1-2.065 5.15A8 8 0 0 1 17.063 13zM4.116 5.85A8 8 0 0 1 6.94 11H2.051a9.95 9.95 0 0 1 2.065-5.15M11 11H8.95A9.98 9.98 0 0 0 5.5 4.4 9.96 9.96 0 0 1 11 2.05zm2-8.95a9.96 9.96 0 0 1 5.5 2.35 9.98 9.98 0 0 0-3.45 6.6H13zm6.886 3.8A9.95 9.95 0 0 1 21.95 11h-4.889a8 8 0 0 1 2.824-5.15Z" />
  </Svg>
);
export default SvgBallBasket;
