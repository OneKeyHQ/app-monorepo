import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHomeSimple = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 9.773c0-.56 0-.84.07-1.098a2 2 0 0 1 .304-.638c.157-.218.374-.395.808-.747l4.8-3.9c.72-.585 1.08-.877 1.479-.989a2 2 0 0 1 1.078 0c.4.112.76.404 1.479.989l4.8 3.9c.434.352.651.529.807.747a2 2 0 0 1 .304.638c.071.259.071.539.071 1.098V16.8c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C18.48 20 17.92 20 16.8 20H7.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C4 18.48 4 17.92 4 16.8V9.773Z"
    />
  </Svg>
);
export default SvgHomeSimple;
