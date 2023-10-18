import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEarth = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m4.172 8.07 2.682 2.013a1.315 1.315 0 0 0 1.964-.46 1.32 1.32 0 0 1 .854-.684l2.174-.547a1.946 1.946 0 0 0 1.413-1.415l.867-3.468M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9.575 3.998-.823-1.234a1.197 1.197 0 0 1 1.073-1.859l.826.053c.344.022.676.135.962.327l1.371.921a1.453 1.453 0 0 1-.81 2.659h-.98c-.65 0-1.258-.325-1.619-.867Z"
    />
  </Svg>
);
export default SvgEarth;
