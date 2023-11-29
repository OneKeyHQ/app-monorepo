import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHomeRoof = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m5 7.511 6.069-4.344c.335-.24.502-.36.685-.406a1 1 0 0 1 .492 0c.183.046.35.166.685.406L19 7.51m-14 0v9.29c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C6.52 20 7.08 20 8.2 20h7.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C19 18.48 19 17.92 19 16.8V7.511m-14 0-2.5 1.79M19 7.511l2.5 1.79"
    />
  </Svg>
);
export default SvgHomeRoof;
