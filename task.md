# ALD-Reader — Roadmap OCR local + Déploiement

## Objectif OCR

Remplacer les APIs cloud payantes (Mistral OCR, Google Vision) par un moteur OCR
entièrement **on-device** basé sur Google ML Kit.
Aucune donnée n'est envoyée à un serveur externe. Fonctionne hors-ligne.

## Architecture cible

```text
PDF scanné
  └─► react-native-pdf-to-image  (PDF → images PNG, 1 par page)
        └─► @react-native-ml-kit/text-recognition  (image → texte, on-device)
              └─► splitIntoChunks()  →  pages[]  →  TTS
```

Les PDF textuels (non scannés) continuent d'utiliser le parseur local existant —
aucun changement pour eux.

---

## Phase 1 — Migration vers Expo Dev Build

> Obligatoire : ML Kit et pdf-to-image sont des modules natifs.
> L'Expo Go ne suffit plus ; il faut générer le code natif une fois.

- [x] Lire `app.json` et vérifier la config Expo (bundleIdentifier, package, plugins)
- [x] Lancer `npx expo prebuild --clean` → génère `android/` et `ios/`
- [x] Vérifier l'absence d'erreurs dans la sortie prebuild

---

## Phase 2 — Dépendances OCR

- [x] Installer `react-native-pdf-to-image` (v3.3.0)
- [x] Installer `@react-native-ml-kit/text-recognition` (v2.0.0)
- [x] Ajouter les plugins nécessaires dans `app.json` — autolinking, aucun plugin Expo requis
- [ ] `cd ios && pod install` (iOS — si Mac disponible)
- [ ] Vérifier sync Gradle Android

---

## Phase 3 — Service OCR local

- [x] Créer `src/services/localOcrService.ts`
  - PDF → images via `react-native-pdf-to-image`
  - OCR via `@react-native-ml-kit/text-recognition`
  - Nettoyage automatique des fichiers temporaires

---

## Phase 4 — Intégration dans documentService

- [x] Dans `extractPdf` : remplacer `performCloudOCR` par `localOcrService.extractTextFromScannedPdf`
- [x] Supprimer la fonction `performCloudOCR` et `stripMarkdown`
- [x] Supprimer l'import `expo-network` et la dépendance `expo-network`
- [x] Mettre à jour les messages d'erreur (supprimer les références au cloud)

---

## Phase 5 — Nettoyage settings & types

- [x] Retirer `ocrApiKey` et `ocrProvider` de `PlayerSettings` et `DEFAULT_SETTINGS`
- [x] Supprimer `setOcrApiKey` et `setOcrProvider` du store (`playerStore.ts`)
- [x] Retirer la section "Analyse OCR" de `SettingsSheet.tsx`
- [x] Supprimer `src/services/translationService.ts` (dépend de Mistral)
- [x] Supprimer `translateCurrentDocument` du store (dépend de translationService)
- [x] Retirer le bouton "🔠 Traduire" du header reader (`reader.tsx`)

---

## Phase 6 — Tests locaux

> Nécessite Android Studio installé sur la machine de développement.

- [ ] `npx expo run:android` — build debug sur émulateur ou appareil branché
- [ ] Test : ouvrir un PDF scanné → vérifier que le texte est extrait localement
- [ ] Test : ouvrir un PDF texte → vérifier que l'extraction locale existante est inchangée
- [ ] Test : ouvrir un EPUB → vérifier l'ordre des chapitres (fix OPF spine)
- [ ] Test : changer de langue → vérifier que le TTS utilise la bonne voix
- [ ] Vérifier qu'aucun appel réseau n'est fait pendant l'OCR (mode avion)

---

## Phase 7 — Déploiement complet

### 7.1 Prérequis (une seule fois)

- [ ] Installer EAS CLI : `npm install -g eas-cli` _(nécessite internet — à faire sur votre machine)_
- [x] Créer `eas.json` avec profils development / preview / production
- [x] Mettre à jour `app.json` (métadonnées Play Store, icône, permissions)
- [ ] Créer un compte Expo : <https://expo.dev/signup>
- [ ] Se connecter : `eas login` (email + mot de passe Expo)
- [ ] Créer le projet EAS : `eas project:init` → récupère le `projectId` réel
- [ ] Remplacer `"your-project-id"` dans `app.json` par le vrai `projectId`
- [ ] Remplacer `"votre-compte-expo"` dans `app.json` par votre nom d'utilisateur Expo

### 7.2 Build Android — Test interne (APK)

> APK installable directement sur un appareil, sans passer par le Play Store.

- [ ] `eas build --platform android --profile preview`
- [ ] Télécharger l'APK depuis <https://expo.dev> une fois le build terminé
- [ ] Installer sur l'appareil de test : `adb install ald-reader.apk`
- [ ] Vérifier OCR, TTS, navigation, progression

### 7.3 Build Android — Production (AAB)

> Format requis par le Google Play Store.

- [ ] Incrémenter `versionCode` dans `app.json` avant chaque soumission
- [ ] `eas build --platform android --profile production`
- [ ] EAS gère la clé de signature automatiquement (stockée de façon sécurisée)

### 7.4 Soumission Google Play Store

- [ ] Créer un compte Google Play Developer : <https://play.google.com/console> (25 $ une fois)
- [ ] Créer une nouvelle application "ALD-Reader" dans la console
- [ ] Remplir la fiche Play Store (description, captures, classification)
- [ ] `eas submit --platform android` — soumet l'AAB directement depuis EAS
  - Ou : téléverser l'AAB manuellement dans Play Console → Production
- [ ] Soumettre pour révision (délai Google : 3–7 jours pour la 1ère app)

### 7.5 Build iOS (si Mac disponible)

- [ ] `cd ios && pod install`
- [ ] Créer un compte Apple Developer : <https://developer.apple.com> (99 $/an)
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios` — soumet à l'App Store Connect
- [ ] Remplir la fiche App Store (description, captures, classification d'âge)
- [ ] Soumettre pour révision Apple (délai : 1–3 jours)

### 7.6 Mises à jour futures (OTA — sans passer par les stores)

> Pour les mises à jour JS uniquement (pas de modification native).

- [ ] `eas update --branch production --message "Description du correctif"`
- [ ] L'app se met à jour automatiquement au prochain lancement

---

## Commandes de référence rapide

```bash
# Développement local
npx expo run:android            # build debug Android
npx expo run:ios                # build debug iOS (Mac uniquement)

# Builds EAS
eas build -p android --profile preview      # APK de test
eas build -p android --profile production   # AAB Play Store
eas build -p ios --profile production       # IPA App Store

# Soumission aux stores
eas submit -p android           # Google Play
eas submit -p ios               # App Store

# Mise à jour OTA (JS uniquement)
eas update --branch production --message "Fix: ..."

# Voir l'état des builds
eas build:list
```

---

## Notes techniques

| Librairie | Rôle | Taille estimée |
| --------- | ---- | -------------- |
| `react-native-pdf-to-image` | Rendu natif PDF → PNG (PdfRenderer Android, PDFKit iOS) | ~0 MB (API système) |
| `@react-native-ml-kit/text-recognition` | OCR on-device Latin/CJK/Cyrillique/Arabe/Devanagari | ~6 MB |

**Langues ML Kit supportées** (couvre les 12 langues de l'app) :

- Latin : fr, en, de, es, pt, it — modèle de base inclus
- Chinois, Japonais, Coréen, Hindi — modèles téléchargés au premier usage (on-device)
- Arabe, Russe — fallback script LATIN (best-effort)

**Ce qui a été supprimé** :

- Clé API Mistral / Google Vision → plus nécessaire
- Vérification de la connexion réseau avant OCR → supprimée
- `translationService.ts`, `performCloudOCR`, `stripMarkdown` → supprimés

**Ce qui reste inchangé** :

- Extraction locale pour PDF textuels (`base64PdfToText`)
- Extraction EPUB via JSZip + OPF spine
- Extraction TXT
- Tout le pipeline TTS / Zustand / UI
