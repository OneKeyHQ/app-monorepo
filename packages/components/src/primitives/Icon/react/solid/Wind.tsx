import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWind = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 5a.994.994 0 0 0-.707.293 1 1 0 1 1-1.414-1.414A3 3 0 1 1 11 9H3a1 1 0 0 1 0-2h8a1 1 0 1 0 0-2Zm8 4a.994.994 0 0 0-.707.293 1 1 0 1 1-1.414-1.414A3 3 0 1 1 19 13H3a1 1 0 1 1 0-2h16a1 1 0 1 0 0-2ZM2 16a1 1 0 0 1 1-1h12a3 3 0 1 1-2.121 5.121 1 1 0 0 1 1.414-1.414A1 1 0 1 0 15 17H3a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWind;
