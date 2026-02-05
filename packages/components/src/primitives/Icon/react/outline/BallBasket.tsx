import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallBasket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M8.95 13a9.95 9.95 0 0 1-2.067 5.148A7.96 7.96 0 0 0 11 19.936V13zM13 19.936a7.96 7.96 0 0 0 4.116-1.788A9.95 9.95 0 0 1 15.051 13H13zM4.064 13A7.95 7.95 0 0 0 5.5 16.661 7.95 7.95 0 0 0 6.937 13zm13 0a7.95 7.95 0 0 0 1.435 3.661A7.95 7.95 0 0 0 19.936 13zm1.435-5.662A7.95 7.95 0 0 0 17.064 11h2.872a7.95 7.95 0 0 0-1.437-3.662M13 11h2.05a9.95 9.95 0 0 1 2.066-5.15A7.96 7.96 0 0 0 13 4.064zm-2-6.937a7.96 7.96 0 0 0-4.117 1.788A9.95 9.95 0 0 1 8.949 11H11zM5.5 7.338A7.95 7.95 0 0 0 4.064 11h2.873A7.95 7.95 0 0 0 5.5 7.338" />
  </Svg>
);
export default SvgBallBasket;
