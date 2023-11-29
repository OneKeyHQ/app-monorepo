import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPullRequest = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 0v8m0 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm11 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm0 0V7.5a2 2 0 0 0-2-2H12m0 0L14.5 3M12 5.5 14.5 8"
    />
  </Svg>
);
export default SvgPullRequest;
