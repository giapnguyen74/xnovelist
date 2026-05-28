export interface ProjectStorage {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(prefix?: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}
