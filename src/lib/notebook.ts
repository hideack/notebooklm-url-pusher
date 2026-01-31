export const NOTEBOOK_ORIGIN = "https://notebooklm.google.com";

export const normalizeNotebookUrl = (rawUrl: string): string => {
  const parsed = new URL(rawUrl);
  if (parsed.origin !== NOTEBOOK_ORIGIN) {
    throw new Error("NotebookLMのURLではありません。");
  }
  if (!parsed.pathname.startsWith("/notebook/") || parsed.pathname.length <= "/notebook/".length) {
    throw new Error("ノートブックURLの形式が正しくありません。");
  }
  let pathname = parsed.pathname;
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return `${parsed.origin}${pathname}`;
};
