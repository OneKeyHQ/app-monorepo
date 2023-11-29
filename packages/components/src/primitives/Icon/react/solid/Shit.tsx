import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShit = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 4c0-1.012.894-2.187 2.237-1.846a5.002 5.002 0 0 1 3.218 7.119 4.001 4.001 0 0 1 2.345 4.976A3.501 3.501 0 0 1 18.5 21h-13a3.5 3.5 0 0 1-1.3-6.75 4 4 0 0 1 2.052-4.848A4 4 0 0 1 10 4h2.001Zm-1 5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Zm3 5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShit;
