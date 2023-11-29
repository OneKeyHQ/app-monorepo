import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceAddReaction = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10.499 9.5c0 .828-.56 1.5-1.25 1.5s-1.25-.672-1.25-1.5.56-1.5 1.25-1.5 1.25.672 1.25 1.5Zm5.5 0c0 .828-.56 1.5-1.25 1.5s-1.25-.672-1.25-1.5.56-1.5 1.25-1.5 1.25.672 1.25 1.5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.999 1a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0V6h-2a1 1 0 0 1 0-2h2V2a1 1 0 0 1 1-1Zm-7.006 1.945a1 1 0 0 1-.884 1.104 8.001 8.001 0 1 0 8.842 8.841 1 1 0 0 1 1.988.22C21.386 18.11 17.148 22 12 22 6.477 22 2 17.523 2 12c0-5.147 3.888-9.385 8.889-9.939a1 1 0 0 1 1.104.884Zm-3.53 11.176a1 1 0 0 1 1.415 0 3 3 0 0 0 4.242 0 1 1 0 0 1 1.415 1.415 5 5 0 0 1-7.072 0 1 1 0 0 1 0-1.415Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceAddReaction;
