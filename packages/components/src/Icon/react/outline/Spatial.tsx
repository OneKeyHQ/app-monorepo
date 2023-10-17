import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpatial = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 9.69v4.62m0-4.62 4-2.309m-4 2.31V4.309m0 10 4 2.31m-4-2.31-4.66-2.69m8.66 5 4-2.31m-4 2.31-4.66 2.69m8.66-5V9.691m0 4.618v5.382m0-10-4-2.31m4 2.31 4.66 2.69m-8.66-5 4.66-2.69M8 4.309 4.34 6.423a2 2 0 0 0-1 1.732v3.464M8 4.309l3-1.732a2 2 0 0 1 2 0l3.66 2.114m0 0 3 1.732a2 2 0 0 1 1 1.732v4.226m0 0v3.464a2 2 0 0 1-1 1.732L16 19.691m0 0-3 1.732a2 2 0 0 1-2 0l-3.66-2.114m0 0-3-1.732a2 2 0 0 1-1-1.732V11.62"
    />
  </Svg>
);
export default SvgSpatial;
