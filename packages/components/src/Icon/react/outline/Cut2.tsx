import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCut2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7 14 4.833-2m0 0 .167-.069m-.167.069.167.069M11.833 12 7 10m5 1.931L21.5 8l-2.03-1.69a2 2 0 0 0-2.117-.28l-4.191 1.934A2 2 0 0 0 12 9.78v2.151Zm0 0v.138m0 0v2.151a2 2 0 0 0 1.162 1.816l4.19 1.934a2 2 0 0 0 2.119-.28L21.5 16 12 12.069ZM9 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </Svg>
);
export default SvgCut2;
