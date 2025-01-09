import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBookmark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 18.54V6.2c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C17.48 3 16.92 3 15.8 3H8.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C5 4.52 5 5.08 5 6.2v12.34c0 1.372 0 2.058.259 2.344a1 1 0 0 0 .887.318c.38-.056.817-.586 1.69-1.645L10.764 16c.423-.515.635-.772.89-.865a1 1 0 0 1 .69 0c.255.093.466.35.89.865l2.93 3.557c.872 1.06 1.308 1.589 1.69 1.645a1 1 0 0 0 .886-.318c.259-.286.259-.972.259-2.344Z"
    />
  </Svg>
);
export default SvgBookmark;
