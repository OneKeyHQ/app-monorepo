import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSlides = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v1h1a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-1H5a3 3 0 0 1-3-3V7Zm4 4v3H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H9a3 3 0 0 0-3 3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSlides;
