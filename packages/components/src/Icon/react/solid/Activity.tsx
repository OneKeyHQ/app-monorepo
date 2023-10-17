import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgActivity = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7.38 10.842 9 5.309l4.56 15.582c.421 1.438 2.459 1.438 2.88 0l2.099-7.173a1 1 0 0 1 .96-.719H22a1 1 0 1 0 0-2h-2.502a3 3 0 0 0-2.879 2.158L15 18.689 10.44 3.108c-.421-1.438-2.459-1.438-2.88 0L5.461 10.28a1 1 0 0 1-.96.72H2a1 1 0 1 0 0 2h2.501a3 3 0 0 0 2.88-2.158Z"
    />
  </Svg>
);
export default SvgActivity;
