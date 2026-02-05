import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBasket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.097 3.16a.99.99 0 0 1 1.287.552l1.73 4.328h2.203c.927 0 1.627.84 1.461 1.75l-1.726 9.494a1.98 1.98 0 0 1-1.948 1.626H5.896a1.98 1.98 0 0 1-1.948-1.626L2.222 9.791A1.485 1.485 0 0 1 3.683 8.04h2.202l1.731-4.328a.99.99 0 1 1 1.838.735L8.017 8.04h7.966l-1.437-3.593a.99.99 0 0 1 .551-1.287m-9.2 15.77h12.207l1.62-8.91H4.277z" />
  </Svg>
);
export default SvgBasket;
