import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLibrary = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M13.649 3.064a1 1 0 0 1 1.287.585l6 16a1 1 0 0 1-1.872.702l-6-16a1 1 0 0 1 .585-1.287ZM4 3a1 1 0 0 1 1 1v16a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm5 0a1 1 0 0 1 1 1v16a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLibrary;
