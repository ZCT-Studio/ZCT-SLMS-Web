import { readFileSync, writeFileSync } from "node:fs";
const version = readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
if (!semver.test(version)) throw new Error("VERSION 必须是有效的 SemVer 版本，例如 2.2.0-beta.1");
for (const filename of ["package.json", "package-lock.json"]) {
  const url = new URL("../" + filename, import.meta.url);
  const original = readFileSync(url, "utf8");
  const data = JSON.parse(original);
  data.version = version;
  if (filename === "package-lock.json" && data.packages?.[""]) data.packages[""].version = version;
  const updated = JSON.stringify(data, null, 2) + "\n";
  if (updated !== original.replace(/\r\n/g, "\n")) writeFileSync(url, updated);
}
console.log(`Version: ${version}`);
