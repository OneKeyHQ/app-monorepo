import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMoney = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 7a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V7Zm3-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2H4Zm8 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm7 6.5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMoney;
