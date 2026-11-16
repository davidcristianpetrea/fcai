import { mkdir, writeFile } from "node:fs/promises";

const generatedDirectory = new URL("../generated/", import.meta.url);
await mkdir(generatedDirectory, { recursive: true });
await writeFile(
  new URL("constants.json", generatedDirectory),
  `${JSON.stringify({ version: "0.1.0", generated: true }, null, 2)}\n`,
);
