import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageAnnotation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.002 3h14a3 3 0 0 1 3 3v10.036a3 3 0 0 1-3 3h-3.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-3.65a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm1.248 8a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm4.5 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm5.75 1.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageAnnotation;
