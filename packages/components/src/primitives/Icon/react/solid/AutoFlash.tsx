import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAutoFlash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.002 2.401c0-1.484-1.925-2.067-2.748-.832L3.188 13.668c-.665.997.05 2.332 1.248 2.332h5.566v5.599c0 1.484 1.925 2.067 2.748.832l8.066-12.099C21.48 9.335 20.766 8 19.568 8h-5.566V2.401Zm1.907 19.059a1 1 0 0 0 1.682 1.08l-1.682-1.08ZM21.25 15l.978-.21a1 1 0 0 0-1.82-.33l.842.54Zm.522 7.21a1 1 0 1 0 1.956-.42l-1.956.42Zm-4.18.33 4.5-7-1.683-1.08-4.5 7 1.682 1.08Zm2.68-7.33 1.5 7 1.956-.42-1.5-7-1.956.42ZM18 21.5h4v-2h-4v2Z"
    />
  </Svg>
);
export default SvgAutoFlash;
