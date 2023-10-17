import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolders = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 7V6a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l1.121 1.121a1 1 0 0 0 .707.293H20a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2M2 18v-8a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l1.121 1.121a1 1 0 0 0 .707.293H16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"
    />
  </Svg>
);
export default SvgFolders;
