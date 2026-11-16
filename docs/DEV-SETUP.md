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

## Run the Windows development pieces

Start each process in its own PowerShell window. The dashboard is separate
from the local device services:

```powershell
# Dashboard/Node server preview
pnpm --filter @adsense/web dev

# Device agent
uv run --directory device\agent --python 3.12 adsense-agent

# USB webcam vision, using the OpenCV fallback during development
uv run --directory device\vision --python 3.12 adsense-vision --fallback

# Two-window camera + TV preview demo
uv run --directory device\vision --python 3.12 adsense-vision-demo --fallback
```

For MediaPipe detection, provide a compatible `.task` model instead:

```powershell
uv run --directory device\vision --python 3.12 adsense-vision --model C:\path\to\face_detector.task
```

Configure the agent before starting it when using the deployed Node server:

```powershell
$env:ADSENSE_CLOUD_BASE_URL = "https://YOUR_WORKER_DOMAIN"
$env:ADSENSE_DEVICE_ID = "windows-dev-display"
$env:ADSENSE_PLATFORM = "windows"
uv run --directory device\agent --python 3.12 adsense-agent
```

The C920 adapter selects DirectShow first and Media Foundation as a Windows
fallback. A physical camera is not required for agent tests; use
`NullIndicator` or a `HudIndicator` callback rather than GPIO.
