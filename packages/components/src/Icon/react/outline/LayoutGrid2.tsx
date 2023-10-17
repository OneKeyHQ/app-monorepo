import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLayoutGrid2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 7.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C5.52 4 6.08 4 7.2 4H10v6H4V7.2ZM14 4h2.8c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C20 5.52 20 6.08 20 7.2V10h-6V4ZM4 14h6v6H7.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C4 18.48 4 17.92 4 16.8V14Zm10 0h6v2.8c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C18.48 20 17.92 20 16.8 20H14v-6Z"
    />
  </Svg>
);
export default SvgLayoutGrid2;
