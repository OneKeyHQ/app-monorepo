import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSandbox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m21.267 2.543-.652 4.631L18 7.817l-.553 3.936L20.897 15H22v6H2v-6h1.037l1.504-1.767L3.079 6.67l1.567-.22a3 3 0 0 1 5.943-.835l1.564-.22.406 6.447 2.954-.695.507-3.607-2.336-1.34.65-4.632zM5.662 15H17.98l-2.023-1.904-4.066.957-3.873-1.822-2.355 2.768ZM7.48 5.041a1 1 0 0 0-.852 1.128l1.98-.278a1 1 0 0 0-1.128-.85m8.373.096 1.402.803 1.57-.386.183-1.31-2.97-.417-.184 1.31Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSandbox;
