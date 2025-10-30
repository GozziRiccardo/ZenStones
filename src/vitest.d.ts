declare module 'vitest' {
  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: () => any) => void;
  export const expect: any;
  export const beforeEach: (fn: () => void) => void;
  export const afterEach: (fn: () => void) => void;
}
