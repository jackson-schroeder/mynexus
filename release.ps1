# Publish a new myNexus version: builds the Windows installer, ships it as an auto-update,
# and refreshes the phone web app. Run from this folder:   .\release.ps1
# First time only:                                        .\release.ps1 -Repo "yourname/mynexus"
param([string]$Repo, [string]$Notes = 'Improvements and fixes')
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location $PSScriptRoot
if ($Repo) { @{ repo = $Repo } | ConvertTo-Json | Set-Content release.json }
if (-not (Test-Path release.json)) { throw 'First run: .\release.ps1 -Repo "yourname/mynexus"' }
$repo = (Get-Content release.json | ConvertFrom-Json).repo; $owner, $name = $repo -split '/'

npm version patch --no-git-tag-version | Out-Null
$ver = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "Building myNexus $ver ..."
npx electron-builder --win nsis --config build-nexus.json --publish never "-c.publish.provider=github" "-c.publish.owner=$owner" "-c.publish.repo=$name"

# phone web app (served by GitHub Pages from /docs)
Remove-Item docs -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory docs | Out-Null
Copy-Item index.html, manifest.webmanifest, sw.js docs
Copy-Item css, js, pwa docs -Recurse
New-Item docs\.nojekyll -ItemType File | Out-Null

git add -A; git commit -m "myNexus $ver"; git push
gh release create "v$ver" "dist\myNexus\myNexus-Setup.exe" "dist\myNexus\myNexus-Setup.exe.blockmap" "dist\myNexus\latest.yml" --title "myNexus $ver" --notes $Notes
Write-Host "Done. Installed apps update themselves; the phone app updates next time it opens."
