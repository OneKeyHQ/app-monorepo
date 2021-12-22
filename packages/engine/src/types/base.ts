type BaseObject = {
  id: string;
};

type HasName = BaseObject & {
  name: string;
};

export type { HasName };
