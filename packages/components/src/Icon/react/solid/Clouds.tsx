import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgClouds = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.36 6.132A7 7 0 1 0 9 20h7.5a5.5 5.5 0 0 0 3.102-10.042 5 5 0 1 0-9.241-3.825Zm1.89.667a7.029 7.029 0 0 1 2.508 2.22c.07.1.248.183.431.138a5.51 5.51 0 0 1 2.584-.009 3 3 0 0 0-5.523-2.35Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClouds;
