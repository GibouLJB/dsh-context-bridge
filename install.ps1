[CmdletBinding()]
param(
    [ValidateSet('desktop', 'web')]
    [string]$Profile = 'desktop',
    [string]$DshCliPath,
    [string]$PackagePath
)

$ErrorActionPreference = 'Stop'
$packageName = 'dsh-context-bridge-0.1.3.tgz'
$packageHash = '2EE82C3F57DD40760071A46CF7214DBBB4C64680CAE91011BFAAA0C377655A21'
$packageUrl = "https://github.com/GibouLJB/dsh-context-bridge/releases/download/v0.1.3/$packageName"
$bundledCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'

function Test-ReleasePackage([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -eq $packageHash
}

try {
    if ($DshCliPath) {
        if (-not (Test-Path -LiteralPath $DshCliPath -PathType Leaf)) {
            throw "The specified DSH CLI does not exist: $DshCliPath"
        }
        $cli = (Resolve-Path -LiteralPath $DshCliPath).ProviderPath
    } elseif (Test-Path -LiteralPath $bundledCli -PathType Leaf) {
        $cli = $bundledCli
    } else {
        $command = Get-Command -Name 'dsh.cmd', 'dsh.exe' -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $command) {
            throw 'DSH CLI is missing. Install DeepSeek Harness, register its dsh command, or supply -DshCliPath.'
        }
        $cli = $command.Source
    }

    if ($Profile -eq 'desktop' -and (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)) {
        # The bundled CLI uses the desktop executable even when it serves only the Web profile.
        $processes = Get-CimInstance Win32_Process -Filter "name = 'DeepSeek Harness.exe'" -ErrorAction SilentlyContinue
        $desktopRunning = !$processes -or ($processes | Where-Object {
            $_.CommandLine -notmatch '(?i)[\\/]dsh-desktop-host[\\/]lib[\\/]cli\.js"?\s+web(?:\s|$)'
        })
        if ($desktopRunning) {
            throw 'DeepSeek Harness Desktop is running. Use App > Quit or quit from the system tray, then run this script again.'
        }
    }

    if ($PackagePath) {
        $localPackage = (Resolve-Path -LiteralPath $PackagePath).ProviderPath
    } else {
        $localPackage = Join-Path $PSScriptRoot $packageName
    }
    if ((Test-Path -LiteralPath $localPackage) -and -not (Test-ReleasePackage $localPackage)) {
        throw "The local archive does not match the official v0.1.3 SHA-256: $localPackage"
    }

    # pnpm records the archive path, so keep a stable copy outside the temporary directory.
    $cacheDir = Join-Path $env:LOCALAPPDATA 'DSH Context Bridge\packages'
    $cachedPackage = Join-Path $cacheDir $packageName
    if (-not (Test-ReleasePackage $cachedPackage)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
        $staged = Join-Path $cacheDir ("$packageName." + [guid]::NewGuid() + '.tmp')
        try {
            if (Test-Path -LiteralPath $localPackage -PathType Leaf) {
                Copy-Item -LiteralPath $localPackage -Destination $staged
            } else {
                Write-Host "Downloading $packageName from GitHub Releases..."
                Invoke-WebRequest -UseBasicParsing -Uri $packageUrl -OutFile $staged -TimeoutSec 60
            }
            if (-not (Test-ReleasePackage $staged)) {
                throw 'The package failed SHA-256 verification. Download v0.1.3 again from the official release.'
            }
            Move-Item -LiteralPath $staged -Destination $cachedPackage -Force
        } finally {
            if (Test-Path -LiteralPath $staged) { Remove-Item -LiteralPath $staged -Force }
        }
    }

    $packageSpec = 'file:' + $cachedPackage.Replace('\', '/')
    Write-Host "Installing DSH Context Bridge v0.1.3 and dsh-chat-import@0.26.6 into '$Profile'..."
    & $cli plugin --profile $Profile add 'dsh-chat-import@0.26.6' $packageSpec
    if ($LASTEXITCODE -ne 0) {
        throw "DSH could not install the plugins (exit code $LASTEXITCODE). See the DSH output above. For Desktop, initialize the profile by opening the app once and quitting it."
    }

    if ($Profile -eq 'desktop') {
        Write-Host 'Installed. Reopen DeepSeek Harness Desktop and look for Project Migration in the sidebar.'
    } else {
        Write-Host 'Installed. Restart DSH Web with your usual launcher and look for Project Migration in the sidebar.'
    }
} catch {
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
    exit 1
}
