# ALD-Reader

**ALD-Reader** transforme vos documents (**PDF**, **EPUB**, **TXT**) en lecture audio : extraction de texte intelligente, synthèse vocale multilingue, aperçu visuel des pages et surlignage de la phrase en cours.

> Documentation complète : **[docs/DOCUMENTATION.md](./docs/DOCUMENTATION.md)** (architecture, OCR, déploiement, dépannage).

---

## Fonctionnalités

- Import PDF / EPUB / TXT depuis l'appareil
- **12 langues** TTS avec choix de la **voix système**
- PDF : texte embarqué si possible, sinon **OCR** (ML Kit local ou Mistral / Gemini en ligne)
- **Aperçu** des pages PDF et surlignage de la lecture
- Progression et texte extrait **mis en cache** hors ligne
- Thème clair / sombre

---

## Prérequis

- Node.js 18+
- Build **native** (EAS ou `expo run:android` / `ios`) — pas Expo Go seul (ML Kit, conversion PDF)

---

## Démarrage rapide

```bash
npm install
npx expo start
# avec modules natifs :
npx expo run:android
```

---

## Déploiement

```bash
npm run deploy              # OTA (canal preview)
npm run deploy:android      # Build APK preview
./scripts/deploy.sh --help  # Toutes les commandes
```

Détails : [section Déploiement](./docs/DOCUMENTATION.md#12-déploiement-eas) dans la doc complète.

| Ressource | URL |
|-----------|-----|
| Builds EAS | https://expo.dev/accounts/delmat237/projects/docuvoice/builds |
| Updates OTA | https://expo.dev/accounts/delmat237/projects/docuvoice/updates |

---

## Stack

Expo SDK 54 · React Native 0.81 · TypeScript · Expo Router · Zustand · expo-speech · ML Kit · react-native-pdf-to-image

---

## Licence

MIT — voir `LICENSE` si présent.
