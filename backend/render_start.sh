#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR_ENV="${PROJECT_DIR:-}"

declare -a CANDIDATES
if [[ -n "${PROJECT_DIR_ENV}" ]]; then
  CANDIDATES=("${PROJECT_DIR_ENV}" "${SCRIPT_DIR}/${PROJECT_DIR_ENV}")
else
  CANDIDATES=(
    "${SCRIPT_DIR}/project"
    "${SCRIPT_DIR}/backend/project"
    "project"
    "backend/project"
  )
fi

PROJECT_DIR=""
for candidate in "${CANDIDATES[@]}"; do
  if [[ -f "${candidate}/manage.py" ]]; then
    PROJECT_DIR="${candidate}"
    break
  fi
done

if [[ -z "${PROJECT_DIR}" ]]; then
  echo "ERROR: manage.py not found."
  echo "Checked paths:"
  for candidate in "${CANDIDATES[@]}"; do
    echo "  - ${candidate}/manage.py"
  done
  echo "Current working directory: $(pwd)"
  echo "Script directory: ${SCRIPT_DIR}"
  echo "Set PROJECT_DIR env var explicitly if needed."
  exit 1
fi

echo "[render_start] Using project dir: ${PROJECT_DIR}"
cd "${PROJECT_DIR}"

echo "[render_start] Running migrations..."
python manage.py migrate --noinput

SUPERUSER_USERNAME="${DJANGO_SUPERUSER_USERNAME:-}"
SUPERUSER_EMAIL="${DJANGO_SUPERUSER_EMAIL:-}"
SUPERUSER_PASSWORD="${DJANGO_SUPERUSER_PASSWORD:-}"

if [[ -n "${SUPERUSER_USERNAME}" && -n "${SUPERUSER_PASSWORD}" ]]; then
  echo "[render_start] Ensuring admin user '${SUPERUSER_USERNAME}' exists..."
  python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

User = get_user_model()

username = os.getenv("DJANGO_SUPERUSER_USERNAME")
email = os.getenv("DJANGO_SUPERUSER_EMAIL", "")
password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

if not username or not password:
    print("[render_start] Skipping superuser bootstrap (username/password missing)")
else:
    defaults = {
        "email": email,
        "role": "admin",
        "is_staff": True,
        "is_superuser": True,
        "is_active": True,
    }
    user, created = User.objects.get_or_create(username=username, defaults=defaults)

    changed_fields = []
    if email and user.email != email:
        user.email = email
        changed_fields.append("email")
    if user.role != "admin":
        user.role = "admin"
        changed_fields.append("role")
    if not user.is_staff:
        user.is_staff = True
        changed_fields.append("is_staff")
    if not user.is_superuser:
        user.is_superuser = True
        changed_fields.append("is_superuser")
    if not user.is_active:
        user.is_active = True
        changed_fields.append("is_active")

    if changed_fields:
        user.save(update_fields=changed_fields)

    user.set_password(password)
    user.save(update_fields=["password"])

    if created:
        print(f"[render_start] Created admin user: {username}")
    else:
        print(f"[render_start] Updated admin user: {username}")
PY
else
  echo "[render_start] Skipping superuser bootstrap (set DJANGO_SUPERUSER_USERNAME and DJANGO_SUPERUSER_PASSWORD to enable)"
fi

if [[ "${RUN_COLLECTSTATIC:-1}" == "1" ]]; then
  echo "[render_start] Running collectstatic..."
  python manage.py collectstatic --noinput
fi

if [[ -n "${WEB_SERVER_CMD:-}" ]]; then
  echo "[render_start] Starting custom server command: ${WEB_SERVER_CMD}"
  exec sh -c "${WEB_SERVER_CMD}"
fi

echo "[render_start] Starting Daphne..."
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
