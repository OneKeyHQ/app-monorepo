// Base database object interfaces needed by shared utilities
// These are minimal interfaces - full implementations are in kit-bg

export interface IDBBaseObject {
  id: string;
}

export interface IDBBaseObjectWithName extends IDBBaseObject {
  name: string;
}

// Minimal account interface for shared utilities
export interface IDBAccountBase extends IDBBaseObjectWithName {
  impl?: string;
  networks?: string[];
  createAtNetwork?: string;
}

// Minimal wallet interface for shared utilities  
export interface IDBWalletBase extends IDBBaseObjectWithName {
  passphraseState?: string;
  nextIds?: Record<string, number>;
}