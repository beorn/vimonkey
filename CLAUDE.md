# vitestx - Vitest Extension

Vitest plugin with ergonomic fuzz testing: gen/take generators, test.fuzz() with auto-shrinking, and Provider-based fuzz terms for inkx integration.

## Commands
bun test vendor/beorn-vitestx/   # run tests

## Architecture
src/
├── index.ts           # Public API (re-exports ergonomic + terms)
├── plugin.ts          # Vitest plugin
├── env.ts             # TEST_SYS environment handling
├── random.ts          # Seeded RNG (LCG algorithm)
├── ergonomic/         # Primary API
│   ├── gen.ts         # gen() and take() async generators
│   ├── test-fuzz.ts   # test.fuzz() wrapper with tracking
│   ├── context.ts     # FuzzContext for tracking state
│   ├── shrink.ts      # Delta-debugging shrink
│   └── regression.ts  # __fuzz_cases__/ save/load
└── fuzz/terms/        # Provider-based fuzz terms
    ├── fuzz-term.ts   # createFuzzTerm (random/smart pick)
    └── replay-term.ts # createReplayTerm (replay history)

## Key APIs

### gen/take (async generators)
gen(['j','k','h','l'])              — uniform random from array
gen([[40,'j'],[40,'k'],[20,'Enter']]) — weighted random
gen((ctx) => ctx.random.pick([...]))  — custom picker

take(generator, 100)                — limit + auto-track for shrinking

### test.fuzz (vitest wrapper)
test.fuzz('name', async () => {
  for await (const key of take(gen(['j','k']), 100)) {
    await handle.press(key)
    expect(...)  // On failure: auto-shrink, save to __fuzz_cases__/
  }
})

### Fuzz Terms (inkx Provider interface)
createFuzzTerm({ keys, count, seed })  — random key provider
createFuzzTerm({ pick, count })        — smart/async pick provider
createReplayTerm(sequence)             — replay provider for shrinking

All terms implement inkx's Provider<FuzzState, { key: KeyEvent }>.

## Future Improvements

All composable on the existing gen/take/test.fuzz primitives:

**Preconditioned generators** — filter actions based on current state:
```typescript
gen((ctx) => {
  const available = actions.filter(a => preconditions[a]?.(getState()) ?? true)
  return ctx.random.pick(available)
})
// Could wrap as: genWithPreconditions(actions, preconditions, getState)
```

**Automatic invariant checking** — check properties after every action:
```typescript
// Helper that wraps an async iterable to check invariants after each yield
async function* withInvariants(source, check) { for await (const item of source) { yield item; check() } }
// Or: just put expect() calls at the bottom of the for-await loop body
```

**AI-driven exploration** — LLM picks actions via custom picker:
```typescript
gen(async (ctx) => {
  const state = describeState(getState())
  return await askLLM(`Given state: ${state}, pick from: ${actions}`)
})
// Could wrap as: createAiPicker({ model, actions, getState })
```

**Strategy comparison** — run same test with different generators:
```typescript
for (const strategy of [uniformGen, weightedGen, aiGen]) {
  test.fuzz(`invariants hold (${strategy.name})`, async () => {
    for await (const key of take(strategy, 100)) { ... }
  })
}
```

**Chaos testing on vitestx** — replace km's custom chaos runner with gen/take.
Refactor ChaosWatcher scenario logic into functions (expandEditToAtomic, etc.),
then build a generator that picks random FS ops, applies chaos transforms inline,
and yields low-level events. The generator maintains file state and performs
actual FakeFileSystem ops for ground truth:
```typescript
async function* chaosEventGen(fs, scenarios) {
  const files = new Set(fs.getAllFiles())
  while (true) {
    const op = chooseOne(['create','modify','delete','rename'])
    // ... perform op on FakeFileSystem, build base event ...

    // Inline chaos transforms:
    if (scenarios.has('EDITOR_ATOMIC') && event.type === 'change') {
      yield { type: 'unlink', path: event.path }  // expanded: 1→2 events
      yield { type: 'add', path: event.path }
    } else if (scenarios.has('QUEUE_OVERFLOW') && random() < 0.2) {
      continue  // drop event
    } else {
      if (scenarios.has('SLOW_DISK')) await sleep(randomDelay())
      yield event
    }
  }
}

test.fuzz('sync survives chaos', async () => {
  const fs = new FakeFileSystem()
  fs.createRandomFiles(fileCount)
  await initialSync(fs)

  for await (const event of take(gen(chaosEventGen(fs, scenarios)), 200)) {
    sync.handleFilesystemEvent(event)  // pull-based, no ChaosWatcher needed
  }
  await waitForQuiescence()
  checkInvariants(fs, database)  // all 8 invariants
  // Gets shrinking + regression cases for free
})
```
Key insight: pull-based iteration eliminates push/pull mismatch. Event expansion
(EDITOR_ATOMIC yielding 2 events) works naturally via multiple yields. Shrinking
may break atomic pairs — but if the test still fails, that reveals a real bug.
See bead `km-vitestx-chaos` for full architecture analysis.

See bead `km-vitestx-adapters` for the previously-deleted Surface abstraction pattern.

## Code Style

- Factory functions (`createX()` with options), not classes
- Explicit deps, no globals/singletons
- ESM imports only
- TypeScript strict mode
