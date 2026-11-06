# Viva-La-Vida
 Viva La Vida – Indian Sign Language (ISL) Translator
 
 Django app with a dark-green, neon-accented sign-in and sign-up experience.

## Run locally

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install django
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

## Authentication notes

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

## Optional environment variables

```bash
# Hosts allowed to serve the app (defaults to localhost/127.0.0.1)
DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"
# Origins allowed to POST when served behind an HTTPS proxy/tunnel
DJANGO_CSRF_TRUSTED_ORIGINS="https://your-preview-host.example.com"
```

## Manual test checklist

1. Open `/signup/`, submit empty → three inline errors, no request sent.
2. Enter a short password and mismatched confirmation → both errors shown.
3. Create an account → redirected to `/` with a welcome message.
4. Sign out → back on `/signin/`; sign in with the same credentials → homepage.
5. Sign in with a wrong password → "Incorrect username or password" and the
   username stays filled in.
6. Press "Continue as guest" → homepage shows the Guest badge.
