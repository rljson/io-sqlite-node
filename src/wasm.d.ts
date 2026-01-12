declare module '*.wasm' {
  const content: string;
  export default content;
}

declare module '*.wasm?url' {
  const content: string;
  export default content;
}
