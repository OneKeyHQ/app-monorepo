import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronGrabberHor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9.707 7.293a1 1 0 0 0-1.414 0Zm4.586 0a1 1 0 0 1 1.414 0L19 10.586a2 2 0 0 1 0 2.828l-3.293 3.293a1 1 0 0 1-1.414-1.414L17.586 12l-3.293-3.293a1 1 0 0 1 0-1.414Zm-6 0L5 10.586ZM5 10.586a2 2 0 0 0 0 2.828ZM6.414 12l3.293 3.293a1 1 0 1 1-1.414 1.414L5 13.414"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M9.707 8.707a1 1 0 0 0-1.414-1.414L5 10.586a2 2 0 0 0 0 2.828l3.293 3.293a1 1 0 0 0 1.414-1.414L6.414 12l3.293-3.293Z"
    />
  </Svg>
);
export default SvgChevronGrabberHor;
