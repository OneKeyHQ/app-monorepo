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
      d="m21.267 2.543-.652 4.632L18 7.816l-.553 3.937 3.446 3.243.003.004H22v6H2v-6h1.037l1.503-1.769-.022-.104-1.439-6.458 1.072-.15.495-.07a3.001 3.001 0 0 1 5.917-.987l.026.152 1.564-.22.405 6.447 2.955-.695.507-3.608-1.75-1-.586-.338.65-4.632zM4 19h16v-2H4zm1.662-4H17.98l-2.024-1.903-3.726.877-.34.079-3.873-1.824zm.253-6.71-.414.058.663 2.973 1.32-1.551 3.029 1.424-.221-3.52zm1.564-3.249a1 1 0 0 0-.853 1.129l1.98-.278A1 1 0 0 0 7.48 5.04Zm8.373.097 1.402.802 1.568-.385.185-1.31-2.97-.418-.185 1.31Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSandbox;
