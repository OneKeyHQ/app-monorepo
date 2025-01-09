import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSign = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 16v4m0-4H6a2 2 0 0 1-1.6-.8l-1.5-2a2 2 0 0 1 0-2.4l1.5-2A2 2 0 0 1 6 8h5a1 1 0 0 1 1 1v7Zm1-12h5a2 2 0 0 1 1.6.8l1.5 2a2 2 0 0 1 0 2.4l-1.5 2a2 2 0 0 1-1.6.8h-5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
    />
  </Svg>
);
export default SvgSign;
