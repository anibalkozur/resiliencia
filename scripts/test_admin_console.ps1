# ResiliencIA — DoD Fase A: prueba de la Edge Function `admin_console`
# Verifica: (1) un admin (director) puede llamar whoami/set_flag; (2) la
# escritura queda auditada; (3) un usuario NO-admin recibe 403 not_admin.
#
# Uso (PowerShell):
#   .\scripts\test_admin_console.ps1 `
#     -SupabaseUrl 'https://<ref>.supabase.co' `
#     -PublishableKey '<sb_publishable_...>' `
#     -DirectorEmail 'tu@email' -DirectorPassword '<pass>' `
#     -NonAdminEmail 'otra@email' -NonAdminPassword '<pass>'
#
# Si omites -NonAdmin*, la prueba 403 se saltea.

param(
  [Parameter(Mandatory = $true)][string]$SupabaseUrl,
  [Parameter(Mandatory = $true)][string]$PublishableKey,
  [Parameter(Mandatory = $true)][string]$DirectorEmail,
  [Parameter(Mandatory = $true)][string]$DirectorPassword,
  [string]$NonAdminEmail,
  [string]$NonAdminPassword
)

$ErrorActionPreference = 'Stop'
$fnUrl = "$($SupabaseUrl.TrimEnd('/'))/functions/v1/admin_console"
$authUrl = "$($SupabaseUrl.TrimEnd('/'))/auth/v1/token?grant_type=password"

function Get-UserJwt([string]$email, [string]$password) {
  $body = @{ email = $email; password = $password } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Uri $authUrl -Method Post -Headers @{
        apikey = $PublishableKey; 'Content-Type' = 'application/json'
      } -Body $body
    return @{ ok = $true; token = $r.access_token; error = $null }
  } catch {
    $msg = $_.ErrorDetails.Message
    return @{ ok = $false; token = $null; error = $msg }
  }
}

function Invoke-Admin([string]$jwt, [hashtable]$payload) {
  try {
    $r = Invoke-RestMethod -Uri $fnUrl -Method Post -Headers @{
        Authorization = "Bearer $jwt"; apikey = $PublishableKey; 'Content-Type' = 'application/json'
      } -Body ($payload | ConvertTo-Json -Depth 5)
    return @{ status = 200; body = $r; error = $null }
  } catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    return @{ status = $status; body = $null; error = $_.ErrorDetails.Message }
  }
}

Write-Host "== 1) Login director ==" -ForegroundColor Cyan
$dir = Get-UserJwt $DirectorEmail $DirectorPassword
if (-not $dir.ok) { Write-Host "  LOGIN FALLO: $($dir.error)" -ForegroundColor Red; exit 1 }
Write-Host "  OK (JWT obtido)" -ForegroundColor Green

Write-Host "== 2) whoami (director) ==" -ForegroundColor Cyan
$me = Invoke-Admin $dir.token @{ action = 'whoami' }
Write-Host "  status=$($me.status) body=$($me.body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($me.status -eq 200) { 'Green' } else { 'Red' })

Write-Host "== 3) set_flag (escritura auditada) ==" -ForegroundColor Cyan
$flag = Invoke-Admin $dir.token @{ action = 'set_flag'; payload = @{ key = 'do_a_test'; enabled = $true } }
Write-Host "  status=$($flag.status) body=$($flag.body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($flag.status -eq 200) { 'Green' } else { 'Red' })

Write-Host "== 4) list_audit (debe mostrar la escritura de arriba) ==" -ForegroundColor Cyan
$audit = Invoke-Admin $dir.token @{ action = 'list_audit' }
$entries = $audit.body.entries
if ($entries) {
  $entries | Select-Object -First 5 | ForEach-Object { Write-Host "  - $($_.action) | $($_.created_at) | $($_.payload)" }
} else {
  Write-Host "  (sin entradas)" -ForegroundColor Yellow
}

if ($NonAdminEmail) {
  Write-Host "== 5) NO-ADMIN debe recibir 403 not_admin ==" -ForegroundColor Cyan
  $usr = Get-UserJwt $NonAdminEmail $NonAdminPassword
  if (-not $usr.ok) { Write-Host "  login no-admin fallo: $($usr.error)" -ForegroundColor Yellow }
  else {
    $na = Invoke-Admin $usr.token @{ action = 'whoami' }
    $ok = ($na.status -eq 403)
    Write-Host "  status=$($na.status) body=$($na.error) body2=$($na.body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
    if ($ok) { Write-Host "  PASA: no-admin bloqueado (403)" -ForegroundColor Green }
    else { Write-Host "  FALLA: se esperaba 403, vino $($na.status)" -ForegroundColor Red }
  }
} else {
  Write-Host "== 5) (omitido: no pasaste -NonAdminEmail/-NonAdminPassword) ==" -ForegroundColor Yellow
}

# ===========================================================================
# Fase B — free <-> premium <-> expirado end-to-end
# Requiere: admin_console Y validate_workout redesplegadas con el codigo nuevo,
# y que `has_active_entitlement` y las RPCs 0018 existan en la DB.
# ===========================================================================
$validateUrl = "$($SupabaseUrl.TrimEnd('/'))/functions/v1/validate_workout"

function Invoke-VFn([string]$jwt, [string]$url, $payload) {
  try {
    $r = Invoke-RestMethod -Uri $url -Method Post -Headers @{
        Authorization = "Bearer $jwt"; apikey = $PublishableKey; 'Content-Type' = 'application/json'
      } -Body ($payload | ConvertTo-Json -Depth 10)
    return @{ status = 200; body = $r; error = $null }
  } catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    return @{ status = $status; body = $null; error = $_.ErrorDetails.Message }
  }
}

function Test-PremiumBlocked($result) {
  $reasons = @($result.body.results | ForEach-Object { $_.reason })
  return ($reasons -contains 'premium_required')
}

if ($dir.ok) {
  $testDate = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')

  Write-Host "== 7) Fase B: sim purchase premium_annual (test user) ==" -ForegroundColor Cyan
  $purchase = Invoke-Admin $dir.token @{
    action = 'sim_lifecycle'
    payload = @{ userId = $me.body.userId; product = 'premium_annual'; event = 'purchase'; reason = 'E2E Fase B' }
  }
  Write-Host "  status=$($purchase.status) body=$($purchase.body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($purchase.status -eq 200) { 'Green' } else { 'Red' })

  Write-Host "== 8) Fase B: validate_workout con ejercicio PREMIUM (plancha) ==" -ForegroundColor Cyan
  $v1 = Invoke-VFn $dir.token $validateUrl @{
    sessions = @(@{
      clientOpId = "b-prem-$(New-Guid)"
      exerciseCode = 'plancha'
      value = 30
      target = 30
      source = 'libre'
      ranked = $false
      sessionDate = $testDate
      evidence = @{}
    })
  }
  $blocked1 = Test-PremiumBlocked $v1
  Write-Host "  status=$($v1.status) premium_required=$blocked1 -> $($v1.body | ConvertTo-Json -Compress -Depth 4)" -ForegroundColor $(if (-not $blocked1) { 'Green' } else { 'Red' })
  if (-not $blocked1) { Write-Host "  PASA: con premium activo el ejercicio corre" -ForegroundColor Green }
  else { Write-Host "  FALLA: se esperaba sin premium_required" -ForegroundColor Red }

  Write-Host "== 9) Fase B: sim expire (revoca al vencer) ==" -ForegroundColor Cyan
  $expire = Invoke-Admin $dir.token @{
    action = 'sim_lifecycle'
    payload = @{ userId = $me.body.userId; product = 'premium_annual'; event = 'expire'; reason = 'E2E Fase B' }
  }
  Write-Host "  status=$($expire.status) body=$($expire.body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($expire.status -eq 200) { 'Green' } else { 'Red' })

  Write-Host "== 10) Fase B: validate_workout premium DESPUES de expirar ==" -ForegroundColor Cyan
  $v2 = Invoke-VFn $dir.token $validateUrl @{
    sessions = @(@{
      clientOpId = "b-exp-$(New-Guid)"
      exerciseCode = 'plancha'
      value = 30
      target = 30
      source = 'libre'
      ranked = $false
      sessionDate = $testDate
      evidence = @{}
    })
  }
  $blocked2 = Test-PremiumBlocked $v2
  Write-Host "  status=$($v2.status) premium_required=$blocked2" -ForegroundColor $(if ($blocked2) { 'Green' } else { 'Red' })
  if ($blocked2) { Write-Host "  PASA: expirado -> premium_required (fail-closed)" -ForegroundColor Green }
  else { Write-Host "  FALLA: se esperaba premium_required tras expirar" -ForegroundColor Red }

  Write-Host "== 11) Fase B: list_entitlements (debe estar expirado/vencido) ==" -ForegroundColor Cyan
  $ent = Invoke-Admin $dir.token @{ action = 'list_entitlements'; payload = @{ userId = $me.body.userId } }
  Write-Host "  status=$($ent.status) -> $($ent.body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($ent.status -eq 200) { 'Green' } else { 'Red' })
} else {
  Write-Host "== 7-11) Fase B omitida (no hay JWT de director) ==" -ForegroundColor Yellow
}

Write-Host "== 12) Verificacion final en SQL ==" -ForegroundColor Cyan
Write-Host "  select action, payload, created_at from admin_audit_log order by created_at desc limit 10;"
Write-Host "  select * from entitlements where user_id = (select id from auth.users where email = '$DirectorEmail');"
