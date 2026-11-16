# Windows development setup

The supported development host is Windows 10/11 with Git, Python 3.12,
Node.js 20+, and pnpm 9. Install the repository dependencies from PowerShell:

```powershell
corepack enable
pnpm install
py -3.12 -m pip install uv
uv sync --project device\agent
uv sync --project device\vision
```

Run focused checks without hardware:

```powershell
uv run --project device\agent python -m unittest discover -s device\agent\tests
uv run --project device\vision python -m unittest discover -s device\vision\tests
pnpm test
pnpm typecheck
```

The C920 adapter selects DirectShow first and Media Foundation as a Windows
fallback. A physical camera is not required for agent tests; use
`NullIndicator` or a `HudIndicator` callback rather than GPIO.
