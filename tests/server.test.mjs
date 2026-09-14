import assert from "node:assert/strict";
import test from "node:test";

import { createStaticServer, parsePort } from "../server.mjs";

test("port parsing accepts the default and valid explicit ports", () => {
  assert.equal(parsePort(), 4173);
  assert.equal(parsePort("8080"), 8080);
  for (const value of ["", "0", "65536", "12.5", "port", " 4173"] ) {
    assert.throws(() => parsePort(value), /Port/);
  }
});

test("the static server serves only allowlisted public assets", async (context) => {
  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const home = await fetch(`${origin}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Counting Desk/);
  assert.match(home.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");

  const head = await fetch(`${origin}/core.js`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.match(head.headers.get("content-type"), /text\/javascript/);

  for (const path of ["/README.md", "/server.mjs", "/package.json", "/../README.md", "/%2e%2e/package.json"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404, path);
  }

  const post = await fetch(`${origin}/`, { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
});
