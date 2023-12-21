import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronGrabberVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.586 5a2 2 0 0 1 2.828 0l3.293 3.293a1 1 0 0 1-1.414 1.414L12 6.414 8.707 9.707a1 1 0 0 1-1.414-1.414L10.586 5l.707.707L10.586 5Zm-3.293 9.293a1 1 0 0 1 1.414 0L12 17.586l3.293-3.293a1 1 0 0 1 1.414 1.414L13.414 19a2 2 0 0 1-2.828 0l-3.293-3.293a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronGrabberVer;
