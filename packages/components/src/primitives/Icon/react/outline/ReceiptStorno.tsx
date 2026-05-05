import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgReceiptStorno = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 16H8v-2h8zm-.866-8.47-1.72 1.72 1.72 1.72-1.414 1.414-1.72-1.72-1.72 1.72-1.414-1.414 1.72-1.72-1.72-1.72 1.414-1.414L12 7.836l1.72-1.72z" />
    <Path
      fillRule="evenodd"
      d="m20 22.498-3.267-2.24-2.4 2.06L12 20.314l-2.333 2.002-2.401-2.058L4 22.498V2h16zM6 18.701l.768-.526.633-.434 2.265 1.942 1.684-1.442.65-.558.65.558 1.683 1.442 2.266-1.942.633.434.768.526V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgReceiptStorno;
