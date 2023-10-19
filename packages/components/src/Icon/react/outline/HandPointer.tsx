import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHandPointer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9h5a3 3 0 0 1 3 3v1.83a7.17 7.17 0 0 1-13.516 3.339L3.5 11.5l.75-.938a2 2 0 0 1 2.812-.313L8 11V5a2 2 0 1 1 4 0v4Z"
    />
  </Svg>
);
export default SvgHandPointer;
