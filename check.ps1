# check.ps1 - Spusti pred git push na lokálnu kontrolu
# Pouzitie:  .\check.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Smart Plant Pot - Kontrola pred pushom" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$errors = 0

# ── 1. Backend lint ────────────────────────────────
Write-Host "[1/4] Backend lint..." -ForegroundColor Cyan
Push-Location backend
npm run lint 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARN: Backend lint nasiel problemy" -ForegroundColor Yellow
} else {
    Write-Host "  OK" -ForegroundColor Green
}
Pop-Location

# ── 2. Frontend lint ───────────────────────────────
Write-Host "[2/4] Frontend lint..." -ForegroundColor Cyan
Push-Location frontend
npm run lint 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARN: Frontend lint nasiel problemy" -ForegroundColor Yellow
} else {
    Write-Host "  OK" -ForegroundColor Green
}
Pop-Location

# ── 3. Frontend build ─────────────────────────────
Write-Host "[3/4] Frontend build..." -ForegroundColor Cyan
Push-Location frontend
npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  CHYBA: Frontend build zlyhal!" -ForegroundColor Red
    $errors++
} else {
    $size = (Get-ChildItem -Recurse dist | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "  OK (${size:N1} MB)" -ForegroundColor Green
}
Pop-Location

# ── 4. Docker build (ak mas Docker) ───────────────
Write-Host "[4/4] Docker build test..." -ForegroundColor Cyan
$dockerExists = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerExists) {
    docker build -t smartpot-backend ./backend 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  CHYBA: Backend Docker build zlyhal!" -ForegroundColor Red
        $errors++
    } else {
        Write-Host "  Backend image OK" -ForegroundColor Green
    }

    docker build -t smartpot-frontend ./frontend 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  CHYBA: Frontend Docker build zlyhal!" -ForegroundColor Red
        $errors++
    } else {
        Write-Host "  Frontend image OK" -ForegroundColor Green
    }
} else {
    Write-Host "  Preskakujem (Docker nie je nainstalovany)" -ForegroundColor Yellow
}

# ── Vysledok ──────────────────────────────────────
Write-Host ""
if ($errors -gt 0) {
    Write-Host "ZLYHALO - $errors chyb. Oprav pred pushom!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "VSETKO OK - mozes pushnut!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  git add ." -ForegroundColor White
    Write-Host '  git commit -m "tvoja sprava"' -ForegroundColor White
    Write-Host "  git push" -ForegroundColor White
    Write-Host ""
}
