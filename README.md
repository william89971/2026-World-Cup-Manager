# 2026 World Cup Manager

A fully browser-based 2026 FIFA World Cup football-manager simulation with a real-time **3D match engine**. Manage one of the 48 real qualified nations through the complete tournament — set tactics, run the match in 3D, handle the press, and chase the trophy. No backend, no API calls, session-only state.

Built with **React + Vite + TypeScript**, **Three.js** (match engine), **Zustand** (state), and **Tailwind CSS**.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build
npm run typecheck  # tsc --noEmit
npm run sim        # headless match-engine sanity harness (stats across many sims)
```

## Features

- **48 real teams** with researched 2026 squads — real player names, ages, positions and 1–99 attribute ratings, the official group draw, and the full 12-group → Round-of-32 → Final bracket.
- **Real-time 3D match engine** (Three.js): striped pitch with correct markings, goals, corner flags, stands and an instanced crowd; 22 animated jointed players in team kits; ball physics; a ball-following camera with broadcast/free-look modes and goal cut-aways.
- **Pre-match management**: formation picker, visual XI/bench selection, mentality, pressing intensity, set-piece takers, and an opponent scouting report.
- **Live HUD**: score, clock, possession, shots, fouls, mini-map, speed toggle (1×/2×/5×/⏩), and a pause menu for in-match subs (with fatigue), formation/mentality/pressing changes, and shouts.
- **Career layer**: post-match stats, 1–10 player ratings, a press conference (tone choices affect morale and media reputation), morale, injuries and suspensions.
- **Whole tournament**: the other 47 teams play out instantly using the same engine; group tables, the knockout bracket, a golden-boot race, and a rolling news feed all update as you progress.

## Architecture

```
src/
  data/      research-sourced teams, squads, draw + tournament structure
  engine/    pure-TS match simulation (ai, physics, events) — no React/Three
  render/    Three.js layer that consumes engine WorldState
  match/     MatchController — drives sim + renderer in a rAF loop
  game/      tournament, career, press, difficulty logic
  store/     Zustand global game state
  ui/        React screens + components
```

The match engine is fully decoupled from rendering and UI: the same deterministic simulation powers both the 3D match you watch and the instant background simulations of every other fixture.
