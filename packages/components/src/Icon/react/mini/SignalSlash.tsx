import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSignalSlash = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.22 2.22a.75.75 0 0 1 1.06 0l6.783 6.782a1 1 0 0 1 .935.935l6.782 6.783a.75.75 0 1 1-1.06 1.06l-6.783-6.782a1 1 0 0 1-.935-.935L2.22 3.28a.75.75 0 0 1 0-1.06zm1.416 14.144a9.004 9.004 0 0 1-1.39-10.936L3.349 6.53a7.503 7.503 0 0 0 1.348 8.773.75.75 0 0 1-1.061 1.061zm2.828-2.828a5 5 0 0 1-1.213-5.103l1.262 1.262a3.493 3.493 0 0 0 1.012 2.78.75.75 0 0 1-1.06 1.06zm9.9-9.9a9.004 9.004 0 0 1 1.39 10.937l-1.103-1.104a7.503 7.503 0 0 0-1.348-8.772.75.75 0 1 1 1.061-1.061zm-2.828 2.828a5 5 0 0 1 1.213 5.103l-1.262-1.262a3.493 3.493 0 0 0-1.012-2.78.75.75 0 0 1 1.06-1.06z" />
  </Svg>
);
export default SvgSignalSlash;
