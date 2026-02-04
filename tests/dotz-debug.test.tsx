/**
 * Debug test to verify flush() works with useSyncExternalStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import React, { useSyncExternalStore } from "react"
import { render, createTerm, Box, Text } from "inkx"
import { Writable } from "node:stream"
import { stripAnsi } from "inkx/testing"

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

describe("flush", () => {
  it("detects useSyncExternalStore changes", async () => {
    let value = "initial"
    const listeners = new Set<() => void>()
    const store = {
      subscribe: (l: () => void) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
      getSnapshot: () => value,
    }
    function setValue(v: string) {
      value = v
      listeners.forEach((l) => l())
    }

    function TestComponent() {
      const v = useSyncExternalStore(store.subscribe, store.getSnapshot)
      return (
        <Box>
          <Text>value={v}</Text>
        </Box>
      )
    }

    const { stream, chunks } = createMockStdout()
    const term = createTerm({ stdout: stream })
    const app = await render(<TestComponent />, term, {
      mode: "inline",
      alternateScreen: false,
    })

    const initialPlain = stripAnsi(chunks.join(""))
    expect(initialPlain).toContain("value=initial")

    const beforeUpdate = chunks.length

    setValue("updated")
    app.flush()

    expect(chunks.length).toBeGreaterThan(beforeUpdate)

    const allPlain = stripAnsi(chunks.join(""))
    expect(allPlain).toContain("updated")

    app.unmount()
    term[Symbol.dispose]()
  })
})
