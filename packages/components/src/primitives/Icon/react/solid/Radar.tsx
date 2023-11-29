import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRadar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6.023 3.982A9.985 9.985 0 0 0 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10a9.985 9.985 0 0 0-4.023-8.018L15.9 7.442a6 6 0 1 1-7.803 0l-2.075-3.46Z"
    />
    <Path
      fill="currentColor"
      d="m16.263 2.951-4.23 7.05L12 10h-.034L7.737 2.951A9.961 9.961 0 0 1 12 2c1.525 0 2.97.341 4.263.951Z"
    />
    <Path
      fill="currentColor"
      d="m9.15 9.193 1.101 1.836a2 2 0 1 0 3.498 0l1.101-1.836a4 4 0 1 1-5.7 0Z"
    />
  </Svg>
);
export default SvgRadar;
