# Project: 2026 World Cup Manager

## Stack
React + Vite + TypeScript + Three.js
State: Zustand
No backend, no API calls, session-only state

## Rules
- Never import React inside src/engine/
- Always run `npm run typecheck` before declaring a task done
- Always run `npm run sim` after any match engine changes
- Target: 2.5–3.5 goals/match average, <15% 0-0 results
- npm run build must stay clean at all times

## Git
- Commit after each major area is complete
- Commit messages: feat/fix/refactor prefix

## Model routing rules

Default model: claude-opus-4-8

Switch to claude-fable-5 only when at least one is true:
- Task spans more than 5 files or is expected to take more than 30 minutes
- Task involves images, screenshots, or vision (extract data, rebuild from
  visual, parse figures)
- Previous attempts on Opus stalled or needed more than 2 retries
- Task is async/autonomous and will run without human check-in for over
  an hour

For everything else, stay on Opus 4.8. Do not switch up because the task
feels complex. Switch up only when the criteria above are met.

For doc updates, commit messages, simple migrations, single-file edits,
use claude-sonnet-4-6.

### Calling Fable 5 via the API (prompt caching)

When invoking Fable 5 programmatically, cache the large system prompt so
repeated calls don't re-pay its token cost:

```python
client.messages.create(
    model="claude-fable-5",
    max_tokens=8000,
    system=[
        {
            "type": "text",
            "text": large_system_prompt,
            "cache_control": {"type": "ephemeral"}
        }
    ],
    messages=[...]
)
```
