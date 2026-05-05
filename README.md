# 🎧 ALD-Reader

**ALD-Reader** est une application mobile moderne conçue avec Expo et React Native, permettant de transformer vos documents (PDF, EPUB, TXT) en livres audio personnalisés. Grâce à une extraction de texte intelligente et une synthèse vocale (TTS) de haute qualité, ALD-Reader offre une expérience de lecture immersive et accessible.

---

## ✨ Fonctionnalités Clés

- 📄 **Support Multi-format** : Importez et lisez des fichiers PDF, EPUB et TXT en un clin d'œil.
- 🗣️ **Synthèse Vocale Avancée** : Support de 12 langues avec réglage de la vitesse, de la tonalité et du genre de la voix.
- 🖍️ **Surlignage Dynamique** : Suivez votre lecture visuellement grâce au surlignage des phrases en temps réel (Karaoke-style).
- 🌓 **Interface Premium** : Design moderne, épuré et réactif, optimisé pour une utilisation fluide.
- 💾 **Sauvegarde Automatique** : Reprenez votre lecture exactement là où vous vous étiez arrêté pour chaque document.
- 🌐 **Lecture Hors-ligne** : Une fois importés, vos documents sont traitables sans connexion internet.

---

## 🛠️ Stack Technique

- **Framework** : [Expo SDK 54](https://expo.dev/) / React Native 0.81
- **Langage** : TypeScript
- **Navigation** : Expo Router v6
- **Gestion d'État** : Zustand
- **Traitement de Documents** : JSZip (EPUB), Custom Regex Parser (PDF)
- **Synthèse Vocale** : Expo Speech
- **Persistance** : AsyncStorage

---

## 🚀 Installation & Lancement

### Prérequis
- Node.js (v18+)
- npm ou yarn
- Application **Expo Go** installée sur votre smartphone (disponible sur iOS et Android)

### Étapes
1. **Cloner le projet** :
   ```bash
   git clone <url-du-repo>
   cd docuvoice-expo
   ```

2. **Installer les dépendances** :
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Lancer le serveur de développement** :
   ```bash
   npx expo start
   ```

4. **Scanner le QR Code** :
   Ouvrez l'application Expo Go sur votre téléphone et scannez le QR code affiché dans votre terminal.

---

## 📖 Utilisation

1. **Importer** : Appuyez sur le bouton **+** en bas à droite pour sélectionner un document sur votre téléphone.
2. **Lire** : Cliquez sur un document dans votre bibliothèque pour lancer la lecture.
3. **Personnaliser** : Utilisez l'icône **⚙️ (Paramètres)** en haut à droite pour changer la langue, la voix ou la vitesse de lecture.
4. **Suivre** : Observez le surlignage du texte dans la zone "Contenu du document" pendant que l'app lit pour vous.

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour des changements majeurs, veuillez ouvrir une issue pour discuter de ce que vous aimeriez changer.

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

*Développé avec ❤️ pour une accessibilité numérique accrue.*
