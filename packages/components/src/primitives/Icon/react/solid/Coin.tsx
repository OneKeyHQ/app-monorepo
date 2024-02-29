import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCoin = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9.08 4.098C6.353 4.68 4 7.8 4 12s2.353 7.32 5.08 7.902C7.17 18.03 6 15.11 6 12c0-3.11 1.17-6.03 3.08-7.902ZM14 22h-4c-4.638 0-8-4.726-8-10S5.362 2 10 2h4c4.638 0 8 4.726 8 10s-3.362 10-8 10Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoin;
