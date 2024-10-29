export type BaseTypeSpec = {
  // biome-ignore lint/suspicious/noExplicitAny: base spec, allow any as default to be overriden
  Transaction: any;
  // biome-ignore lint/suspicious/noExplicitAny: base spec, allow any as default to be overriden
  UnsignedTransaction: any;
  // biome-ignore lint/suspicious/noExplicitAny: base spec, allow any as default to be overriden
  RuntimeCall: any;
};

type OverrideType<Base, Override> = {
  [K in keyof Base]: K extends keyof Override ? Override[K] : Base[K];
};

export type RollupTypeSpec<T extends Partial<BaseTypeSpec>> = OverrideType<
  BaseTypeSpec,
  T
>;
