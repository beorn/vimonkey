/**
 * Test that verifies streaming mode renders dots incrementally.
 * Uses inkx's flush() API to force output between store updates.
 *
 * Note: In inline mode, inkx writes incremental diffs (cursor positioning +
 * changed cells) rather than full frames. So we check that flush() produces
 * new output chunks, not specific content in the joined string.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import React from "react"
import { render, createTerm } from "inkx"
import { stripAnsi } from "inkx/testing"
import { Writable } from "node:stream"

import { Report, DEFAULT_SYMBOLS, type Options } from "../src/dotz/index.tsx"
import { createTestStore } from "../src/dotz/store.js"

let prevActEnv: boolean | undefined

beforeEach(() => {
  const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  prevActEnv = g.IS_REACT_ACT_ENVIRONMENT
  g.IS_REACT_ACT_ENVIRONMENT = false
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  g.IS_REACT_ACT_ENVIRONMENT = prevActEnv
  vi.restoreAllMocks()
})

function createOptions(): Options {
  return {
    slowThreshold: 100,
    perfOutput: "",
    showSlow: true,
    symbols: DEFAULT_SYMBOLS,
  }
}

function createMockStdout() {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString())
      callback()
    },
  }) as NodeJS.WriteStream
  stream.isTTY = true
  stream.columns = 80
  stream.rows = 24
  return { stream, chunks }
}

describe("DotzReporter streaming", () => {
  it("flush() produces incremental output after store updates", async () => {
    const { stream, chunks } = createMockStdout()
    const store = createTestStore(100)
    const options = createOptions()

    const term = createTerm({ stdout: stream })
    const app = await render(
      <Report store={store} options={options} width={80} />,
      term,
      { mode: "inline", alternateScreen: false },
    )

    // Initial render should contain legend
    const initialPlain = stripAnsi(chunks.join(""))
    expect(initialPlain).toContain("Legend:")

    // Each store update + flush should produce new output
    const afterInitial = chunks.length

    store.addTest("t1", "pkg-a", "file1.test.ts")
    app.flush()
    expect(chunks.length).toBeGreaterThan(afterInitial)

    const afterAdd = chunks.length
    store.updateTest("t1", "passed", 10)
    app.flush()
    expect(chunks.length).toBeGreaterThan(afterAdd)

    // Burst of updates with single flush
    const afterSingle = chunks.length
    store.addTest("t2", "pkg-a", "file1.test.ts")
    store.addTest("t3", "pkg-a", "file1.test.ts")
    store.updateTest("t2", "passed", 20)
    store.updateTest("t3", "failed", 30, [{ message: "oops" }])
    app.flush()
    expect(chunks.length).toBeGreaterThan(afterSingle)

    app.unmount()
    term[Symbol.dispose]()
  })
})
