import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChromecast = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 3a3 3 0 0 0-3 3v1.038C2.33 7.013 2.664 7 3 7c7.18 0 13 5.82 13 13 0 .337-.013.67-.038 1H19a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H5ZM3 13a1 1 0 1 0 0 2 5 5 0 0 1 5 5 1 1 0 1 0 2 0 7 7 0 0 0-7-7Z"
    />
    <Path
      fill="currentColor"
      d="M2 10a1 1 0 0 1 1-1c6.075 0 11 4.925 11 11a1 1 0 1 1-2 0 9 9 0 0 0-9-9 1 1 0 0 1-1-1Zm1 7a1 1 0 1 0 0 2 1 1 0 0 1 1 1 1 1 0 1 0 2 0 3 3 0 0 0-3-3Z"
    />
  </Svg>
);
export default SvgChromecast;
