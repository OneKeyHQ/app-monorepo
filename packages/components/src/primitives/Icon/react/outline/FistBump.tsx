import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFistBump = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12.002 6V4M8.149 7.404 6.863 5.872m9.001 1.532 1.286-1.532M2 19h5.352a3 3 0 0 0 2.976-2.628l.25-2A3 3 0 0 0 7.603 11H7.5l-.704-.47a2.162 2.162 0 0 0-3.206.996L3 13H2m20 6h-5.35a3 3 0 0 1-2.977-2.628l-.25-2A3 3 0 0 1 16.399 11h.101l.705-.47a2.162 2.162 0 0 1 3.206.996l.59 1.474h1"
    />
  </Svg>
);
export default SvgFistBump;
