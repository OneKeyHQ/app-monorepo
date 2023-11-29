import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPizza = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m17.68 17.528-.252 1.474c-.188 1.099-1.244 1.843-2.31 1.515a17.531 17.531 0 0 1-7.257-4.378 17.531 17.531 0 0 1-4.378-7.257c-.328-1.066.416-2.122 1.515-2.31l1.474-.253M17.68 17.53l.738-4.304m-.738 4.303a14.018 14.018 0 0 1-4.574-1.731M6.472 6.319a14.02 14.02 0 0 0 3.879 7.33 14.115 14.115 0 0 0 2.756 2.148M6.472 6.319l5.635-.966m6.312 7.872a3 3 0 0 0-5.312 2.572m5.312-2.572 1.103-6.438a2 2 0 0 0-2.309-2.31l-1.644.283m0 0a2 2 0 1 1-3.462.594m3.462-.594-3.462.593"
    />
  </Svg>
);
export default SvgPizza;
