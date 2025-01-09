import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHeartBeat = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M21.51 6.903c1.604 4-.494 9.69-9.022 14.47a1 1 0 0 1-.977 0C2.983 16.592.884 10.902 2.489 6.902 3.267 4.96 4.902 3.568 6.83 3.138c1.698-.378 3.553.003 5.17 1.287 1.616-1.284 3.471-1.665 5.169-1.287 1.928.43 3.562 1.822 4.341 3.764ZM11.348 9.47a1 1 0 0 0-1.696 0L8.696 11H8a1 1 0 1 0 0 2h1.25a1 1 0 0 0 .848-.47l.402-.643 1.652 2.643a1 1 0 0 0 1.648.07L15 13h1a1 1 0 1 0 0-2h-1.5a1 1 0 0 0-.8.4l-.625.833-1.727-2.763Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHeartBeat;
