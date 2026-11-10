import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/ai.js";

// Locally generated 2 × 2 images in each supported format.
const images = {
  "image/jpeg": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCOAKcf/9k=",
  "image/png": "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mOUyApgYGBgYmBgYGBgAAAJygDWwNI6pQAAAABJRU5ErkJggg==",
  "image/webp": "UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoCAAIAAUAmJaAABDOAAP7yqP//+YJ/7/f9/u4oAAA=",
  "image/gif": "R0lGODdhAgACAIEAABhqUAAAAAAAAAAAACwAAAAAAgACAAAIBgABCAQQEAA7"
};

const code = "AKE-TEST-GORSEL";
const env = { ANTHROPIC_API_KEY: "test-only", AKE_KODLAR: code + ":premium" };
const payload = { code, json: true, prompt: "Üçgenin iç açıları nedir?" };

function request(body, extraHeaders) {
  return new Request("https://ake.test/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function provider(t) {
  return t.mock.method(globalThis, "fetch", async () =>
    Response.json({ content: [{ type: "text", text: "Örnek çözüm" }] }),
  );
}

test("text-only requests keep Turkish characters", async t => {
  const upstream = provider(t);
  const response = await onRequest({ request: request(payload), env });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, "Örnek çözüm");
  const forwarded = JSON.parse(upstream.mock.calls[0].arguments[1].body);
  assert.equal(forwarded.messages[0].content, payload.prompt);
});

for (const [media_type, data] of Object.entries(images)) {
  test("accepts a valid " + media_type + " image", async t => {
    const upstream = provider(t);
    const response = await onRequest({ request: request({ ...payload, image: { media_type, data } }), env });
    assert.equal(response.status, 200);
    assert.equal(upstream.mock.callCount(), 1);
    const forwarded = JSON.parse(upstream.mock.calls[0].arguments[1].body);
    assert.deepEqual(forwarded.messages[0].content[0].source, { type: "base64", media_type, data });
  });
}

test("rejects mismatched, malformed, incomplete and unsupported images before the model call", async t => {
  const upstream = provider(t);
  for (const image of [
    { media_type: "image/jpeg", data: images["image/png"] },
    { media_type: "image/png", data: "not base64" },
    { media_type: "image/png", data: images["image/png"].slice(0, -12) },
    { media_type: "image/png" },
    { media_type: "text/plain", data: btoa("example") },
  ]) {
    const response = await onRequest({ request: request({ ...payload, image }), env });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "image_rejected");
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test("rejects an over-limit declared request length", async t => {
  const upstream = provider(t);
  const response = await onRequest({
    request: request(payload, { "content-length": "7000001" }), env,
  });
  assert.equal(response.status, 413);
  assert.equal(upstream.mock.callCount(), 0);
});

test("enforces the byte limit for a request stream with no length header", async t => {
  const upstream = provider(t);
  let chunks = 0;
  let cancelled = false;
  const chunk = new Uint8Array(1_000_000).fill(32);
  const body = new ReadableStream({
    pull(controller) {
      if (chunks++ < 8) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() { cancelled = true; },
  });
  const req = new Request("https://ake.test/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body, duplex: "half",
  });
  const response = await onRequest({ request: req, env });
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.equal(upstream.mock.callCount(), 0);
});
