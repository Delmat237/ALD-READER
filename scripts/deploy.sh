#!/usr/bin/env bash
# Déploiement ALD-Reader / docuvoice via EAS
# Usage : ./scripts/deploy.sh [commande] [options]
#
# Commandes :
#   ota [preview|production] [--message "…"]   Mise à jour JS (EAS Update) — le plus courant
#   build-android [preview|production]         Build APK/AAB natif Android
#   build-ios [preview|production]               Build iOS (nécessite credentials)
#   build-all [preview|production]               Build Android + iOS
#   prebuild-android                             Régénère android/ (icônes, etc.)
#
# Exemples :
#   ./scripts/deploy.sh ota
#   ./scripts/deploy.sh ota preview --message "Fix OCR et voix"
#   ./scripts/deploy.sh build-android preview

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE="${PROFILE:-preview}"
MESSAGE="${MESSAGE:-}"
NO_WAIT="${NO_WAIT:-false}"
SKIP_FINGERPRINT="${SKIP_FINGERPRINT:-false}"
SKIP_TSC="${SKIP_TSC:-false}"
REMAINING=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}▶${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✗${NC} $*" >&2; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

ensure_eas() {
  if [[ "$SKIP_TSC" != "true" ]]; then
    log "Vérification TypeScript…"
    npx tsc --noEmit
  fi
}

eas_cmd() {
  npx eas-cli@latest "$@"
}

cmd_ota() {
  local profile="$1"
  local msg="${2:-Mise à jour ALD-Reader}"

  log "Publication OTA — canal « ${profile} »"
  warn "Les utilisateurs doivent avoir une build avec expo-updates et la même runtimeVersion."

  local args=(update --channel "$profile" --non-interactive --message "$msg")
  eas_cmd "${args[@]}"

  log "OTA publiée. Les clients reçoivent l’update au prochain lancement (selon app.json)."
}

cmd_build_android() {
  local profile="$1"
  log "Build Android natif — profil « ${profile} »"

  local args=(build --profile "$profile" --platform android --non-interactive)
  if [[ "$NO_WAIT" == "true" ]]; then
    args+=(--no-wait)
  fi

  eas_cmd "${args[@]}"
  log "Suivi : https://expo.dev/accounts/delmat237/projects/docuvoice/builds"
}

cmd_build_ios() {
  local profile="$1"
  log "Build iOS — profil « ${profile} »"
  warn "iOS peut demander un mode interactif pour les certificats (sans --non-interactive)."

  local args=(build --profile "$profile" --platform ios)
  if [[ "$NO_WAIT" == "true" ]]; then
    args+=(--no-wait)
  else
    args+=(--non-interactive)
  fi

  eas_cmd "${args[@]}" || {
    err "Échec iOS : relancez sans --non-interactive si les credentials manquent."
    exit 1
  }
}

cmd_prebuild_android() {
  log "Prebuild Android (icônes, ressources natives)…"
  npx expo prebuild --platform android --no-install
  log "Prebuild terminé. Enchaînez avec : ./scripts/deploy.sh build-android ${PROFILE}"
}

parse_global_flags() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --message|-m)
        MESSAGE="$2"
        shift 2
        ;;
      --no-wait)
        NO_WAIT=true
        shift
        ;;
      --skip-tsc)
        SKIP_TSC=true
        shift
        ;;
      --help|-h)
        usage 0
        ;;
      *)
        break
        ;;
    esac
  done
  REMAINING=("$@")
}

main() {
  if [[ $# -lt 1 ]]; then
    usage 0
  fi

  local command="$1"
  shift

  parse_global_flags "$@"
  if [[ ${#REMAINING[@]} -gt 0 ]]; then
    set -- "${REMAINING[@]}"
  else
    set --
  fi

  case "$command" in
    ota|update)
      PROFILE="${1:-preview}"
      local msg="${MESSAGE:-${2:-Mise à jour $(date +%Y-%m-%d)}}"
      ensure_eas
      if [[ "$SKIP_FINGERPRINT" == "true" ]]; then
        export EAS_SKIP_AUTO_FINGERPRINT=1
      fi
      cmd_ota "$PROFILE" "$msg"
      ;;
    build-android|android)
      PROFILE="${1:-preview}"
      ensure_eas
      cmd_build_android "$PROFILE"
      ;;
    build-ios|ios)
      PROFILE="${1:-preview}"
      ensure_eas
      cmd_build_ios "$PROFILE"
      ;;
    build-all|build)
      PROFILE="${1:-preview}"
      ensure_eas
      cmd_build_android "$PROFILE"
      cmd_build_ios "$PROFILE" || true
      ;;
    prebuild-android)
      cmd_prebuild_android
      ;;
    help|--help|-h)
      usage 0
      ;;
    *)
      err "Commande inconnue : $command"
      usage 1
      ;;
  esac
}

main "$@"
