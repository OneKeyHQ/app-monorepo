import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRainy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9.5 2a6.5 6.5 0 0 0 0 13H16a5 5 0 1 0-.674-9.955c-.191.026-.36-.065-.426-.165A6.495 6.495 0 0 0 9.5 2ZM7.394 18.447a1 1 0 1 0-1.788-.894l-1 2a1 1 0 1 0 1.788.894l1-2Zm5 0a1 1 0 1 0-1.788-.894l-1 2a1 1 0 1 0 1.788.894l1-2Zm5 0a1 1 0 1 0-1.788-.894l-1 2a1 1 0 1 0 1.788.894l1-2Z"
    />
  </Svg>
);
export default SvgRainy;
