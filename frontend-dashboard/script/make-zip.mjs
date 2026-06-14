import { createWriteStream } from "fs";
import { createGzip } from "zlib";
import { pack } from "tar";

const output = createWriteStream("/home/runner/workspace/dashboard-lpr.tar.gz");
const gzip = createGzip();

gzip.pipe(output);

output.on("close", () => {
  const mb = (output.bytesWritten / 1024).toFixed(0);
  console.log(`OK: ${mb} KB`);
});

pack({
  gzip: false,
  cwd: "/home/runner/workspace",
  filter: (path) => {
    return !path.includes("node_modules") &&
      !path.includes(".git/") &&
      !path.includes("dist/") &&
      !path.includes(".local/") &&
      !path.includes("attached_assets/") &&
      !path.includes("make-zip") &&
      !path.endsWith(".tar.gz") &&
      !path.endsWith(".zip");
  }
}, ["."]).pipe(gzip);
