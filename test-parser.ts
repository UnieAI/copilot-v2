import { parseFile } from "./lib/parsers/index.js";

async function test() {
  const base64 = Buffer.from("hello world test").toString("base64");
  console.log(await parseFile("test.txt", "text/plain", base64));
}

test();
