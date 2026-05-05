Ce que vous devez faire manuellement (nécessite internet + compte)
Étape 1 — Installation et connexion (une seule fois)


npm install -g eas-cli
eas login
eas project:init          # génère votre projectId réel
Puis remplacez "your-project-id" et "votre-compte-expo" dans app.json.

Étape 2 — APK de test (pour valider avant le store)


eas build --platform android --profile preview
→ Lien de téléchargement APK disponible sur expo.dev

Étape 3 — Production Play Store


eas build --platform android --profile production
eas submit --platform android
→ Nécessite un compte Google Play Developer (25 $ une fois)

Étape 4 — Mises à jour futures (sans repasser par le store)


eas update --branch production --message "Description du fix"