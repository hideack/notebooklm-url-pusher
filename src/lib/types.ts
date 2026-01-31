export type Notebook = {
  id: string;
  name?: string;
  url: string;
  createdAt: number;
};

export type StorageState = {
  notebooks: Notebook[];
  lastSelectedByOrigin: Record<string, string>;
};
