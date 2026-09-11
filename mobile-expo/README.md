# mobile-expo — Application Expo / React Native EduSync Pro (MVP)

App mobile **Expo Go** (Android) pour EduSync Pro. Indépendante du projet web.

## Démarrage

```powershell
cd mobile-expo
npx expo start          # QR code → Expo Go Android
```

## Configuration de l'API (important)

Le téléphone doit joindre le serveur Next.js du PC :

1. Récupérez l'IP locale du PC : `ipconfig` (ex. `192.168.1.64`).
2. Créez `mobile-expo/.env.local` :
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.64:3000
   ```
3. Démarrez le backend depuis la racine : `npm run dev` (port 3000).
4. Autorisez le port 3000 dans le pare-feu Windows (réseau privé).
5. Dans Expo Go, scannez le QR (le téléphone et le PC doivent être sur le
   même réseau Wi-Fi ; `localhost` ne fonctionne PAS depuis le téléphone).

Ordre de résolution de l'URL (voir `src/config.ts`) :
`EXPO_PUBLIC_API_URL` → IP LAN détectée via Expo → `localhost:3000`.

## Authentification

- Le backend retourne désormais `token` dans le corps de `POST /api/auth/login`
  (le client web l'ignore — cookie HttpOnly inchangé).
- Le mobile stocke le jeton via AsyncStorage (`src/auth/tokenStorage.ts`) et
  l'envoie en `Authorization: Bearer <token>` (`src/api/client.ts`).
  Le serveur accepte déjà ce mode (`readSessionToken`).
- Déconnexion automatique sur 401 (session expirée/révoquée).

## Structure

```
src/
├── api/client.ts        # client fetch (GET/POST/PUT/PATCH/DELETE + Bearer)
├── auth/
│   ├── AuthProvider.tsx # contexte session (login/logout/restauration/401)
│   ├── authService.ts   # login / logout / restore (/api/auth/*)
│   └── tokenStorage.ts  # AsyncStorage (token + session)
├── config.ts            # résolution EXPO_PUBLIC_API_URL
├── screens/             # Loading / Login / Dashboard (MVP Phase 1)
└── types/index.ts       # types métier partagés (copie contrôlée)
```
