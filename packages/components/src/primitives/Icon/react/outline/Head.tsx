import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHead = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18 14.066V16a2 2 0 0 1-2 2 2 2 0 0 0-2 2 1 1 0 0 1-1 1H8a.998.998 0 0 1-.997-1c0-2.083-.09-3.87-1.514-5.683A7 7 0 0 1 11 3c2.85 0 5.475 1.368 6.556 4.133.627 1.6 1.435 2.689 2.352 4.002a.982.982 0 0 1-.306 1.405l-1.116.669a1 1 0 0 0-.485.857Z"
    />
  </Svg>
);
export default SvgHead;
