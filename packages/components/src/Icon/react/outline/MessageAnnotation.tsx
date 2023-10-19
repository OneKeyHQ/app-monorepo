import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageAnnotation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3.002 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.036a2 2 0 0 1-2 2h-3.626a1 1 0 0 0-.638.23l-2.74 2.27-2.704-2.267a1 1 0 0 0-.642-.233h-3.65a2 2 0 0 1-2-2V6Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.75}
      d="M6.625 11a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.5 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.5 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgMessageAnnotation;
