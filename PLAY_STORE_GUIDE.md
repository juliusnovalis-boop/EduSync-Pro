# 📱 Guide de publication EduSync Pro sur le Google Play Store

Ce guide documente toutes les étapes pour publier **EduSync Pro** sur le Google Play Store, depuis la préparation du build jusqu'à la mise en ligne.

---

## ✅ État actuel du projet (déjà fait)

| Élément | Statut |
|---------|--------|
| Capacitor 8.5.0 installé | ✅ |
| Plateforme Android ajoutée (`android/`) | ✅ |
| Export statique Next.js (`out/`) | ✅ |
| Synchronisation Capacitor (`npx cap sync android`) | ✅ |
| Module API centralisé (`src/spa/lib/api.ts`) | ✅ |
| Script de build mobile (`mobile-build.mjs`) | ✅ |
| Scripts npm (`mobile:build`, `mobile:apk`, `mobile:aab`) | ✅ |

---

## 📋 Prérequis manquants

### 1. Installer le SDK Android

Le SDK Android n'est **pas installé** sur cette machine. Pour compiler l'APK/AAB :

1. **Télécharger Android Studio** : https://developer.android.com/studio
2. **Installer Android Studio** (inclut le SDK Android + outils de build)
3. **Configurer les variables d'environnement** (Windows) :
   ```
   ANDROID_HOME = C:\Users\LENOVO\AppData\Local\Android\Sdk
   ```
   Ajouter à `PATH` :
   ```
   %ANDROID_HOME%\platform-tools
   %ANDROID_HOME%\cmdline-tools\latest\bin
   ```
4. **Vérifier** :
   ```powershell
   echo $env:ANDROID_HOME
   adb --version
   ```

### 2. Créer un compte Google Play Developer

1. Aller sur https://play.google.com/console
2. Cliquer sur **« Aller à la Play Console »**
3. Payer les **25 $** (frais unique de création de compte)
4. Compléter les informations du compte (nom, adresse, etc.)

---

## 🔑 Génération de la clé de signature (keystore)

La clé de signature est **obligatoire** et **définitive** — ne la perdez jamais !

```powershell
# Depuis la racine du projet
keytool -genkey -v -keystore edusync-release.keystore -alias edusync -keyalg RSA -keysize 2048 -validity 10000
```

**IMPORTANT** :
- Conservez ce fichier `.keystore` dans un endroit sûr (jamais dans Git)
- Notez le **mot de passe** et l'**alias** — ils seront nécessaires pour chaque mise à jour
- La clé ne peut **pas être changée** après publication

---

## 🏗️ Compilation de l'AAB (format Play Store)

### Étape 1 : Build mobile (export statique + sync Capacitor)

```powershell
npm run mobile:build
```

### Étape 2 : Configurer la signature dans Gradle

Ouvrir `android/app/build.gradle` et ajouter dans le bloc `android { }` :

```gradle
signingConfigs {
    release {
        storeFile file("../../edusync-release.keystore")
        storePassword "VOTRE_MOT_DE_PASSE"
        keyAlias "edusync"
        keyPassword "VOTRE_MOT_DE_PASSE"
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
}
```

### Étape 3 : Compiler l'AAB signé

```powershell
npm run mobile:aab
```

Le fichier **AAB** sera généré dans :
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Étape 4 (optionnel) : Compiler un APK de test

```powershell
npm run mobile:apk
```

L'**APK** sera dans :
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🚀 Publication sur le Play Store

### 1. Créer l'application dans la Play Console

1. Connectez-vous à https://play.google.com/console
2. Cliquez sur **« Créer une application »**
3. Renseignez :
   - **Nom** : EduSync Pro
   - **Langue** : Français
   - **Type** : Application
   - **Gratuite ou payante** : Gratuite

### 2. Compléter la fiche Play Store

| Champ | Valeur suggérée |
|-------|----------------|
| **Nom** | EduSync Pro |
| **Description courte** | Gestion scolaire complète : élèves, notes, présences, paiements. |
| **Description complète** | EduSync Pro est une plateforme de gestion scolaire pour les établissements d'Afrique francophone. Gérez les élèves, enseignants, classes, notes, présences, paiements, bulletins, emplois du temps, QR codes et documents PDF. Analyse IA intégrée. |
| **Catégorie** | Éducation |
| **Icône** | 512×512 px (générée par Capacitor) |
| **Graphique de fonctionnalité** | 1024×500 px |
| **Captures d'écran** | 2+ captures (téléphone) |
| **Site web** | (votre domaine) |
| **E-mail de contact** | (votre e-mail) |
| **Politique de confidentialité** | URL obligatoire |

### 3. Téléverser l'AAB

1. Aller dans **« Version > Version de production »**
2. Cliquer sur **« Créer une version »**
3. Téléverser `app-release.aab`
4. Remplir les notes de version (ex : « Version initiale »)
5. Cliquer sur **« Envoyer pour examen »**

### 4. Compléter les déclarations

- **Contenu de l'application** : Éducation, non violent
- **Cibles d'âge** : 13+ (données scolaires)
- **Données** : Déclarer la collecte de données (comptes, identifiants)
- **Publicité** : Non

### 5. Test et publication

1. **Test interne** (optionnel) : ajouter des testeurs par e-mail
2. **Test fermé** : tester avec un petit groupe
3. **Test ouvert** : disponible pour tous
4. **Production** : publication publique

---

## 🔄 Mise à jour de l'application

Pour chaque nouvelle version :

```powershell
# 1. Modifier le code
# 2. Incrémenter versionCode et versionName dans android/app/build.gradle
# 3. Rebuild
npm run mobile:build
npm run mobile:aab
# 4. Téléverser le nouvel AAB dans la Play Console
```

---

## ⚠️ Points d'attention

1. **Backend requis** : L'app mobile doit pointer vers un backend déployé (Vercel, Railway, etc.). Configurez `NEXT_PUBLIC_API_URL` ou injectez `window.EDUSYNC_API_URL` dans le WebView.
2. **Clé de signature** : Ne la perdez jamais — sans elle, impossible de mettre à jour l'app.
3. **Identifiant** : `com.edusync.app` est définitif — ne peut pas être changé après publication.
4. **Politique de confidentialité** : Obligatoire pour le Play Store, même pour une app gratuite.
5. **SDK Android** : Doit être installé pour compiler l'AAB (voir section Prérequis).

---

## 📁 Fichiers importants

| Fichier | Rôle |
|---------|------|
| `mobile-build.mjs` | Script de build mobile (export statique + sync) |
| `capacitor.config.ts` | Configuration Capacitor (appId, webDir) |
| `next.config.ts` | Configuration Next.js (export statique mobile) |
| `src/spa/lib/api.ts` | Client API centralisé (base URL configurable) |
| `android/` | Projet Android natif généré par Capacitor |
| `out/` | Export statique du frontend (généré) |