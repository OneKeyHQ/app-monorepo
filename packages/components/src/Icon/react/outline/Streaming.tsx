import Svg, { SvgProps, Path, Circle } from 'react-native-svg';
const SvgStreaming = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 19c.197-1.962 1.765-3.5 4-3.5 2.235 0 3.803 1.538 4 3.5m-1.75-8.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
    />
    <Circle cx={17.75} cy={8.25} r={1.25} fill="currentColor" />
  </Svg>
);
export default SvgStreaming;
