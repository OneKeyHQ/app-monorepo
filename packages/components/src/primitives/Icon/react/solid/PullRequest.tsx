import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPullRequest = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M15.207 2.293a1 1 0 0 1 0 1.414l-.793.793H15.5a3 3 0 0 1 3 3v7.645a3.502 3.502 0 0 1-1 6.855 3.5 3.5 0 0 1-1-6.855V7.5a1 1 0 0 0-1-1h-1.086l.793.793a1 1 0 0 1-1.414 1.414l-2.5-2.5a1 1 0 0 1 0-1.414l2.5-2.5a1 1 0 0 1 1.414 0ZM3 5.5a3.5 3.5 0 1 1 4.5 3.355v6.29A3.502 3.502 0 0 1 6.5 22a3.5 3.5 0 0 1-1-6.855v-6.29A3.502 3.502 0 0 1 3 5.5Z"
    />
  </Svg>
);
export default SvgPullRequest;
