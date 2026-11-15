#!/usr/bin/env bash
set -o errexit
export SECRET_KEY="${SECRET_KEY:-build-time-placeholder-not-used-at-runtime}"
pip install --upgrade pip
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input
