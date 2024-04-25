export type XUDTInfoResponse = {
  data: {
    id: string;
    type: string;
    attributes: XUDTAttributes;
  };
};

export type XUDTAttributes = {
  symbol: string;
  full_name: string;
  icon_file?: string;
  published: boolean;
  description?: string;
  type_hash: string;
  type_script: TypeScript;
  udt_type: string;
  total_amount: string;
  decimal: string;
};

type TypeScript = {
  args: string;
  code_hash: string;
  hash_type: string;
};
