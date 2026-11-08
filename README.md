# Viva La Vida

Viva La Vida – Indian Sign Language (ISL) Translator

Django app with a dark-green, neon-accented sign-in and sign-up experience.

## Run locally

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Open <http://127.0.0.1:8000/signup/> or <http://127.0.0.1:8000/signin/>.

## Routes

| URL | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Translator homepage |
| `/signin/` | GET, POST | Sign in |
| `/signup/` | GET, POST | Create an account |
| `/guest/` | POST | Continue as guest (session flag, no account) |
| `/logout/` | POST | Sign out |
| `/admin/` | — | Django admin |
| `/dictionary/api/` | GET | Dictionary JSON endpoint (search, filter) |
| `/api/recognize/` | POST | Recognition API (JSON landmarks, requires auth) |
| `/api/dictionary/` | GET | Dictionary data JSON (filter by category, supported) |

## Authentication

- Accounts use Django's built-in `User` model; passwords are hashed by Django
  and never stored in localStorage/sessionStorage or in plain text.
- Sign up requires a username, a password (minimum 6 characters) and a matching
  confirmation. Django's common-password, numeric-password and
  username-similarity validators also apply.
- Guest mode only sets `request.session['is_guest']`; it creates no account and
  stores no credentials.
- Validation errors are shown inline. Client-side checks in
  `translator/static/translator/js/auth.js` mirror the server-side rules in
  `translator/views.py`, which remain authoritative.

## Profile

Signed-in users have a one-to-one `UserProfile` with:
- `bio` (max 280 chars) — short personal note shown on the profile page.
- `accent_color` (hex, e.g. `#b6ff3c`) — neon accent colour.
- `auto_speak` — speak the recognised sign aloud automatically.
- `auto_append` — add every recognised sign to the sentence automatically.

Protected pages (`/profile/`, `/dictionary/`, `/practice/`, `/home/`) require a
signed-in account (or guest session). Guest sessions retain full access to the
translator workspace.

## Recognition & Dictionary

The application ships a modular ISL recognition pipeline:

- `translator/recognition/model.py` — `Recognizer` class that loads a trained
  model (pickle/joblump) and predicts from normalised landmarks.
- `translator/recognition/train.py` — training script (RandomForest / Logistic)
  from a dataset of gesture JSON landmarks.
- `translator/recognition/evaluate.py` — evaluation script (heldout or live).
- Recognition history is stored in `RecognitionHistory` per user.

Recognition uses browser-side MediaPipe for hand detection; only compact
landmark vectors are sent to the server — no video is uploaded.

Supported gestures are defined in the `Gesture` model. Run:

```bash
python manage.py createsuperuser
python manage.py shell -c "from translator.models import Gesture; ..."  # to seed gestures
```

## Render deployment

The site is deployed on Render (free tier). The build configuration is in
`render.yaml`:
- `buildCommand`: `pip install -r requirements.txt`
- `startCommand`: `gunicorn config.wsgi:application`

Required environment variables (set in Render → Settings → Environment):
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS` (e.g. `viva-la-vida-1.onrender.com`)
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_DATABASE_URL` (PostgreSQL)
- `RECOGNITION_MODEL_PATH` (absolute path to trained recogniser, optional)

Static files are served via WhiteNoise (added to `MIDDLEWARE` immediately after
`SecurityMiddleware`). `collectstatic` runs as part of the build.

## Test suite

```bash
pip install pytest
DJANGO_SETTINGS_MODULE=config.settings python -m pytest
```
