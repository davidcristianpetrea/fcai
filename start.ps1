$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:ADSENSE_CLOUD_BASE_URL = if ($env:ADSENSE_CLOUD_BASE_URL) { $env:ADSENSE_CLOUD_BASE_URL } else { "https://adsense.davidpetrea.ro" }
$env:ADSENSE_DATA_DIR = Join-Path $root "data"

uv sync --directory (Join-Path $root "device\agent")
uv sync --directory (Join-Path $root "device\vision")

$agent = Start-Process uv -WorkingDirectory $root -ArgumentList @("run", "--directory", "device\agent", "adsense-agent") -PassThru
$vision = Start-Process uv -WorkingDirectory $root -ArgumentList @("run", "--directory", "device\vision", "adsense-vision", "--data-dir", "data") -PassThru
$chromeCandidates = @(
  (Join-Path ${env:ProgramFiles} "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { throw "Google Chrome was not found." }
$profile = Join-Path $root ".display-chrome"
$browser = Start-Process $chrome -ArgumentList @("--kiosk", "--no-first-run", "--disable-session-crashed-bubble", "--autoplay-policy=no-user-gesture-required", "--user-data-dir=$profile", "http://127.0.0.1:8765/") -PassThru
try {
  Wait-Process -Id $browser.Id
} finally {
  foreach ($process in @($browser, $vision, $agent)) {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  }
}
