import test from "node:test";
import assert from "node:assert/strict";
import { getApiBaseLabel, getApiBaseUrl } from "../api";

test("production default API base is same-origin, not localhost", () => {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
  try {
    assert.equal(getApiBaseUrl(), "");
    assert.equal(getApiBaseLabel(), "same-origin /api");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  }
});

test("explicit NEXT_PUBLIC_API_URL is trimmed and respected for local development", () => {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = " http://localhost:4000 ";
  try {
    assert.equal(getApiBaseUrl(), "http://localhost:4000");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  }
});
