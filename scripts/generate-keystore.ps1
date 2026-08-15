# Script de génération du keystore de signature pour EduSync Pro
# Usage : powershell -ExecutionPolicy Bypass -File scripts/generate-keystore.ps1
#
# ⚠️ IMPORTANT : Conservez ce fichier .keystore et le mot de passe en lieu sûr.
#    Sans eux, il est IMPOSSIBLE de mettre à jour l'application sur le Play Store.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Génération du keystore EduSync Pro" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que keytool est disponible (fourni avec le JDK)
$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
    Write-Host "✗ keytool introuvable. Installez le JDK (Java Development Kit) d'abord." -ForegroundColor Red
    exit 1
}

# Demander les informations
$alias = Read-Host "Alias de la clé (défaut: edusync)"
if ([string]::IsNullOrWhiteSpace($alias)) { $alias = "edusync" }

$storePass = Read-Host "Mot de passe du keystore (minimum 6 caractères)" -AsSecureString
$storePassText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePass)
)
if ($storePassText.Length -lt 6) {
    Write-Host "✗ Le mot de passe doit contenir au moins 6 caractères." -ForegroundColor Red
    exit 1
}

$keyPass = Read-Host "Mot de passe de la clé (défaut: identique au keystore)" -AsSecureString
$keyPassText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPass)
)
if ([string]::IsNullOrWhiteSpace($keyPassText)) { $keyPassText = $storePassText }

$name = Read-Host "Nom complet (ex: EduSync Pro)"
$org = Read-Host "Organisation (ex: EduSync)"
$city = Read-Host "Ville (ex: Libreville)"
$country = Read-Host "Code pays 2 lettres (ex: GA)"

# Chemin du keystore
$keystorePath = Join-Path (Get-Location) "edusync-release.keystore"

# Générer le keystore
Write-Host ""
Write-Host "▶ Génération du keystore..." -ForegroundColor Yellow
& keytool -genkey -v `
    -keystore $keystorePath `
    -alias $alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass $storePassText `
    -keypass $keyPassText `
    -dname "CN=$name, OU=$org, O=$org, L=$city, C=$country"

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Échec de la génération du keystore." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Keystore généré : $keystorePath" -ForegroundColor Green
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  INFORMATIONS À CONSERVER PRÉCIEUSEMENT" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Chemin : $keystorePath"
Write-Host "  Alias  : $alias"
Write-Host "  Mot de passe keystore : $storePassText"
Write-Host "  Mot de passe clé      : $keyPassText"
Write-Host ""
Write-Host "⚠️  NE PERDEZ PAS CES INFORMATIONS !" -ForegroundColor Red
Write-Host "    Sans le keystore, vous ne pourrez plus mettre à jour l'application."
Write-Host ""
Write-Host "▶ Prochaine étape : configurez android/app/build.gradle avec ces informations."
Write-Host "  Voir PLAY_STORE_GUIDE.md pour les instructions complètes."