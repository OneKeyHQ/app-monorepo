import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgQueueList = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11a2.5 2.5 0 0 1 0 5h-11A2.5 2.5 0 0 1 2 4.5zm.75 4.583a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H2.75zm0 3.58a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H2.75zm0 3.587a.75.75 0 0 0 0 1.5h14.5a.75.75 0 1 0 0-1.5H2.75z" />
  </Svg>
);
export default SvgQueueList;
