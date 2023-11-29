import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageDots = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.002 3h12a3 3 0 0 1 3 3v10.036a3 3 0 0 1-3 3h-2.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-2.65a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm.498 8.25a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm4.25 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm5.5 1.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageDots;
