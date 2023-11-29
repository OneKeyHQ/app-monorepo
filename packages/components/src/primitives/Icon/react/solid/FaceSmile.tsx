import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceSmile = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm-2.121-7.879a1 1 0 0 0-1.414 1.415 5 5 0 0 0 7.07 0 1 1 0 1 0-1.413-1.415 3 3 0 0 1-4.243 0ZM10.5 9.5c0 .828-.56 1.5-1.25 1.5S8 10.328 8 9.5 8.56 8 9.25 8s1.25.672 1.25 1.5Zm4.25 1.5c.69 0 1.25-.672 1.25-1.5S15.44 8 14.75 8s-1.25.672-1.25 1.5.56 1.5 1.25 1.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceSmile;
