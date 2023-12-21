import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageDots = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.002 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10.036a2 2 0 0 1-2 2h-2.626a1 1 0 0 0-.638.23l-2.74 2.27-2.704-2.267a1 1 0 0 0-.642-.233h-2.65a2 2 0 0 1-2-2V6Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.75}
      d="M6.875 11.25a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.25 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.25 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgMessageDots;
