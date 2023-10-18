import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShit = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7.772 10.009A3 3 0 0 1 10 5h2a1 1 0 0 0 1-1c0-.552.455-1.013.99-.877A4.002 4.002 0 0 1 15.646 10m-7.874.009A3 3 0 0 0 5 13c0 .773.292 1.468.772 2m2-4.991H9M5.772 15H5.5a2.5 2.5 0 0 0 0 5h13a2.5 2.5 0 0 0 0-5h-.272M5.772 15H12m3.646-5H16a3 3 0 0 1 3 3c0 .773-.292 1.468-.772 2m-2.582-5H14m4.228 5H17"
    />
  </Svg>
);
export default SvgShit;
