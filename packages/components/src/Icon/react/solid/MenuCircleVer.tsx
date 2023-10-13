import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMenuCircleVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm-1.25 6a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm0 4a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0ZM12 17.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMenuCircleVer;
