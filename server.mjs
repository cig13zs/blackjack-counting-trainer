import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(projectDirectory, "public");
const HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;

const assets = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/core.js", { file: "core.js", type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/favicon.svg", { file: "favicon.svg", type: "image/svg+xml; charset=utf-8" }],
]);

const securityHeaders = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

function textResponse(response, status, message, extraHeaders = {}) {
  const body = `${message}\n`;
  response.writeHead(status, {
    ...securityHeaders,
    ...extraHeaders,
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

export function createStaticServer() {
  return createHttpServer(async (request, response) => {
    if (!request.method || !["GET", "HEAD"].includes(request.method)) {
      textResponse(response, 405, "Method not allowed", { Allow: "GET, HEAD" });
      return;
    }

    let pathname;
    try {
      pathname = new URL(request.url, `http://${HOST}`).pathname;
    } catch {
      textResponse(response, 400, "Bad request");
      return;
    }

    const asset = assets.get(pathname);
    if (!asset) {
      textResponse(response, 404, "Not found");
      return;
    }

    try {
      const body = await readFile(join(publicDirectory, asset.file));
      response.writeHead(200, {
        ...securityHeaders,
        "Content-Type": asset.type,
        "Content-Length": body.length,
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      console.error(`Could not read ${asset.file}:`, error.message);
      textResponse(response, 500, "Server error");
    }
  });
}

export function parsePort(argument) {
  if (argument === undefined) return DEFAULT_PORT;
  if (!/^\d+$/.test(argument)) throw new RangeError("Port must be a whole number from 1 to 65535.");
  const port = Number(argument);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RangeError("Port must be a whole number from 1 to 65535.");
  }
  return port;
}

function startFromCommandLine() {
  if (process.argv.length > 3) {
    console.error("Usage: node server.mjs [port]");
    process.exitCode = 1;
    return;
  }

  let port;
  try {
    port = parsePort(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const server = createStaticServer();
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Choose another port: node server.mjs 4174`);
    } else {
      console.error(`Counting Desk could not start: ${error.message}`);
    }
    process.exitCode = 1;
  });
  server.listen(port, HOST, () => {
    console.log(`Counting Desk is running at http://${HOST}:${port}`);
    console.log("Press Ctrl+C to stop.");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startFromCommandLine();
}
