import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShieldFailure = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.025 2.278a3 3 0 0 1 1.95 0l6 2.063A3 3 0 0 1 21 7.178v4.735c0 2.806-1.149 4.83-2.813 6.404-1.572 1.489-3.632 2.6-5.555 3.637l-.157.084a1 1 0 0 1-.95 0l-.157-.084c-1.923-1.037-3.983-2.148-5.556-3.637C4.15 16.742 3 14.72 3 11.913V7.178A3 3 0 0 1 5.025 4.34l6-2.063Zm2.268 11.93a1 1 0 0 0 1.414-1.415L13.414 11.5l1.293-1.293a1 1 0 0 0-1.414-1.414L12 10.086l-1.293-1.293a1 1 0 0 0-1.414 1.414l1.293 1.293-1.293 1.293a1 1 0 1 0 1.414 1.414L12 12.914l1.293 1.293Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShieldFailure;
