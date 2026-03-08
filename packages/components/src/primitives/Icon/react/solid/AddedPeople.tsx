import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddedPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m21.373 14.657-4.085 6.808-3.686-2.765 1.199-1.6 1.913 1.435 2.944-4.907z" />
    <Path d="M12.001 12c2.056 0 3.844.658 5.246 1.759l-1.106 1.845L14.4 14.3l-3.6 4.8 2.433 1.9H3.402l.103-1.094C3.917 15.521 7.243 12 12 12Zm0-10a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9" />
  </Svg>
);
export default SvgAddedPeople;
