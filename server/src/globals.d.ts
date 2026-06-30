declare const process: { env: Record<string, string | undefined> };
declare const Buffer: any;
declare function fetch(input: string, init?: unknown): Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;
declare module "node:http" {
  export const createServer: any;
  export type IncomingMessage = any;
  export type ServerResponse = any;
}
declare module "node:crypto" {
  export function randomUUID(): string;
}
