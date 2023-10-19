import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddSlide = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v1h1a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-1H5a3 3 0 0 1-3-3V5Zm14 1H9a3 3 0 0 0-3 3v7H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1Zm-1 5a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2v-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddSlide;
