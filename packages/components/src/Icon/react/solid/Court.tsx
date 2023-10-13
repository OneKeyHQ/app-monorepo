import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCourt = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12.597 2.138a2 2 0 0 0-1.194 0l-7 2.187A2 2 0 0 0 3 6.235v1.764a2 2 0 0 0 2 2V17a1 1 0 1 0 2 0v-7h2v7a1 1 0 1 0 2 0v-7h2v7a1 1 0 1 0 2 0v-7h2v7a1 1 0 1 0 2 0v-7a2 2 0 0 0 2-2V6.233a2 2 0 0 0-1.404-1.909l-7-2.187ZM3 20a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"
    />
  </Svg>
);
export default SvgCourt;
