param(
    [switch]$Install,
    [switch]$BuildBackend,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipCoach,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "spring-backend"
$FrontendDir = Join-Path $Root "frontend"
$CoachDir = Join-Path $Root "ai-study-coach"

function Test-RequiredPath {
    param(
        [string]$Path,
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Name was not found at: $Path"
    }
}

function Test-Port {
    param(
        [int]$Port,
        [string]$Name
    )

    try {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            Write-Warning "$Name port $Port is already in use. The service may fail to start or may already be running."
        }
    } catch {
        # Get-NetTCPConnection is Windows-specific. If unavailable, let the service command report the port problem.
    }
}

function Test-FrontendEnv {
    $envFiles = @(".env.local", ".env.development", ".env") | ForEach-Object {
        Join-Path $FrontendDir $_
    }

    $hasEnv = $false
    foreach ($envFile in $envFiles) {
        if (Test-Path -LiteralPath $envFile) {
            $hasEnv = $true
            break
        }
    }

    if (-not $hasEnv) {
        Write-Warning "Frontend env file not found. Copy frontend\.env.example to frontend\.env.local and fill the Firebase/API values."
    }
}

function ConvertTo-SingleQuotedLiteral {
    param([string]$Value)
    return $Value.Replace("'", "''")
}

function Start-DevWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $titleLiteral = ConvertTo-SingleQuotedLiteral $Title
    $dirLiteral = ConvertTo-SingleQuotedLiteral $WorkingDirectory

    $script = @"
`$ErrorActionPreference = 'Stop'
try { `$Host.UI.RawUI.WindowTitle = '$titleLiteral' } catch {}
Set-Location -LiteralPath '$dirLiteral'
Write-Host ''
Write-Host '$titleLiteral'
Write-Host 'Working directory: $dirLiteral'
Write-Host ''
$Command
"@

    if ($DryRun) {
        Write-Host "[$Title]"
        Write-Host $script
        return
    }

    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    Start-Process -FilePath "powershell.exe" -WorkingDirectory $WorkingDirectory -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        $encoded
    )
}

Test-RequiredPath $BackendDir "Spring backend directory"
Test-RequiredPath $FrontendDir "Frontend directory"
Test-RequiredPath $CoachDir "AI Study Coach directory"

if (-not $SkipBackend) {
    Test-RequiredPath (Join-Path $BackendDir "mvnw.cmd") "Spring backend Maven wrapper"
    $serviceAccount = Join-Path $BackendDir "src\main\resources\serviceAccountKey.json"
    if (-not (Test-Path -LiteralPath $serviceAccount)) {
        Write-Warning "Spring backend Firebase serviceAccountKey.json is missing. Backend startup will fail until it exists."
    }
    Test-Port 8080 "Spring backend"
}

if (-not $SkipFrontend) {
    Test-RequiredPath (Join-Path $FrontendDir "package.json") "Frontend package.json"
    Test-FrontendEnv
    Test-Port 3000 "Next.js frontend"
}

if (-not $SkipCoach) {
    Test-RequiredPath (Join-Path $CoachDir "requirements.txt") "AI Study Coach requirements.txt"
    if (-not (Test-Path -LiteralPath (Join-Path $CoachDir ".env"))) {
        Write-Warning "AI Study Coach .env is missing. Copy ai-study-coach\.env.example to ai-study-coach\.env and set COACH_* values."
    }
    Test-Port 8000 "AI Study Coach"
}

$installLiteral = if ($Install) { '$true' } else { '$false' }
$buildBackendLiteral = if ($BuildBackend) { '$true' } else { '$false' }

if (-not $SkipBackend) {
    $backendCommand = @"
if ($buildBackendLiteral) {
    .\mvnw.cmd -q -DskipTests package
    if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
}
.\mvnw.cmd spring-boot:run
"@
    Start-DevWindow "QAI Spring Backend (:8080)" $BackendDir $backendCommand
}

if (-not $SkipFrontend) {
    $frontendCommand = @"
if (-not (Test-Path -LiteralPath '.\node_modules')) {
    Write-Warning 'node_modules is missing. Run .\start-dev.ps1 -Install from the repo root if npm run dev fails.'
}
if ($installLiteral) {
    npm install
    if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
}
npm run dev
"@
    Start-DevWindow "QAI Next.js Frontend (:3000)" $FrontendDir $frontendCommand
}

if (-not $SkipCoach) {
    $coachCommand = @"
if ($installLiteral -and -not (Test-Path -LiteralPath '.\venv\Scripts\python.exe')) {
    python -m venv venv
    if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
}
if (Test-Path -LiteralPath '.\venv\Scripts\Activate.ps1') {
    . .\venv\Scripts\Activate.ps1
} else {
    Write-Warning 'No ai-study-coach venv found. Using the current Python environment.'
}
if ($installLiteral) {
    python -m pip install -r requirements.txt
    if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
}
python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
"@
    Start-DevWindow "QAI AI Study Coach (:8000)" $CoachDir $coachCommand
}

if (-not $DryRun) {
    Write-Host "Started requested QAI services in separate PowerShell windows."
    Write-Host "Frontend: http://localhost:3000"
    Write-Host "Backend:  http://localhost:8080"
    Write-Host "Coach:    http://localhost:8000"
    Write-Host "External dependencies still need to run separately when used: n8n (:5678) and LM Studio (:1234)."
}
