import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCoins = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 5a5 5 0 0 0-.941 9.912 7.003 7.003 0 0 1 5.112-7.67A4.996 4.996 0 0 0 9 5Zm6.33 2.008a7 7 0 1 0-6.66 9.985 7 7 0 1 0 6.66-9.985ZM15 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoins;
