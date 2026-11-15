# Deploy on Render

## Commands
| Field | Value |
|---|---|
| **Build Command** | `bash build.sh`  (same as: `pip install -r requirements.txt && python manage.py collectstatic --no-input && python manage.py migrate --no-input`) |
| **Start Command** | `gunicorn vivalavida.wsgi:application` |
| Runtime | Python 3 (`.python-version` = 3.12.8) |

## Option A – Blueprint (easiest, includes the database)
1. Put the contents of this folder at the ROOT of a GitHub repository (manage.py must be at the top level).
2. Render dashboard -> New -> **Blueprint** -> choose the repository. `render.yaml` creates the web service + a free Postgres database and generates `SECRET_KEY`.

## Option B – manual Web Service
1. Render -> New -> **Web Service** -> connect the repository (or set *Root Directory* to the folder that contains manage.py).
2. Build Command and Start Command as above.
3. Environment variables:
   - `SECRET_KEY` = any long random string (required)
   - `PYTHON_VERSION` = `3.12.8`
   - `DATABASE_URL` = the *Internal Database URL* of a Render Postgres database (recommended). Without it the app uses SQLite, whose file is wiped on every deploy/restart on Render's free plan (accounts and progress would be lost).
   - optional: `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` (comma separated) if you add a custom domain.

## Notes
- Render sets `RENDER` and `RENDER_EXTERNAL_HOSTNAME` itself: the app switches to production mode (DEBUG off, secure cookies, allowed host, CSRF origin).
- Render serves the site over HTTPS, so the camera works. First camera start needs internet (hand-tracking files from public CDNs).
- Free web services sleep after ~15 minutes without traffic; the first request afterwards takes about a minute. Free Postgres databases expire after 30 days - export/upgrade if you need long-term accounts.
- The `ml/` folder (dataset + training) is not used at runtime; it only adds ~6 MB to the repository.
- Local development is unchanged: `python manage.py runserver` (DEBUG on, SQLite).
