import {
  TypeWriter as BaseTypeWriter,
  Highlight,
  NormalText,
} from './TypeWriter';

/* eslint @typescript-eslint/no-unsafe-member-access: "off" */
const Base: any = BaseTypeWriter;
Base.Highlight = Highlight;
Base.NormalText = NormalText;

type ITypeWriter = typeof BaseTypeWriter & {
  Highlight: typeof Highlight;
  NormalText: typeof NormalText;
};

const TypeWriter = Base as ITypeWriter;
export default TypeWriter;
// @ts-ignore
// export default memo(TypeWriter) as ITypeWriter;
