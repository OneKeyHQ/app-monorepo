import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWalletCrypto = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.496 12.886a1 1 0 0 1 1.008 0l3 1.75A1 1 0 0 1 10 15.5V19a1 1 0 0 1-.496.864l-3 1.75a1 1 0 0 1-1.008 0l-3-1.75A1 1 0 0 1 2 19v-3.5a1 1 0 0 1 .496-.864l3-1.75ZM4 16.074v2.352l2 1.166 2-1.166v-2.352l-2-1.166-2 1.166Z"
      clipRule="evenodd"
    />
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M3 6.5v5.527l1.488-.868a3 3 0 0 1 3.024 0l3 1.75A3 3 0 0 1 12 15.5V21h6a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3h-1V5.412A2.412 2.412 0 0 0 14.588 3H6.5A3.5 3.5 0 0 0 3 6.5ZM6.5 8a1.5 1.5 0 1 1 0-3h8.088c.228 0 .412.184.412.412V8H6.5Zm9 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWalletCrypto;
