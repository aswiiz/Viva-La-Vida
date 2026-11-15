# viva la vida – gesture translator (Django + Google AI Edge MediaPipe)

    pip install -r requirements.txt
    python manage.py migrate
    python manage.py runserver

Open http://localhost:8000 (camera needs localhost or HTTPS, plus internet for the CDN + hand model).

Pages
| URL | Page |
|---|---|
| `/login/`, `/signup/` | Django auth (username + password, min 6 chars), "Continue as guest" |
| `/` | Home – live translation |
| `/practice/` | Practice – progress is saved to the account (guests: this browser) |
| `/dictionary/` | All 19 signs (🙌 uses two hands) |
| `/account/` | Name, learned signs, speech toggle, change password, reset progress, sign out |
| `/api/progress/` | JSON: learned sign ids only (login required) |

Layout: `translator/templates/translator/*.html`, `translator/static/translator/{css,js,img}`.
JS modules: `signs.js` (gestures), `engine.js` (recognition rules + 2 s hold), `camera.js` (HandLandmarker), one module per page.
The database (SQLite) stores accounts and learned sign ids only. Camera frames and landmarks never leave the browser.
When you add a sign in `signs.js`, add its id to `translator/signs.py` too.

Recognition
- `camera.js` mirrors the frame, runs MediaPipe **GestureRecognizer** (hand landmarks + Google's gesture classifier trained on real hands) for up to **2 hands** (21 landmarks + metric 3D world landmarks each) and smooths jitter.
- `engine.js` decides finger/thumb state from 3D joint angles (independent of camera angle/distance); on-screen landmarks give directions.
  Vulcan 🖖 = two finger pairs split apart; 🫲 = open hand sideways; 🙌 = two open upright hands held apart; 🤛 = a fist whose knuckles face the left of the screen (a right-facing fist is not a sign).
- Fusion (`fuseHand` in `engine.js`): Google's classifier knows 7 gestures (fist, thumbs up/down, victory, I-love-you, pointing up, open palm). When it is confident it confirms or vetoes the matching rule result; when the rules are unsure and it is very confident it supplies the answer. Other signs (pointing sideways/down, horns, call, three, four, vulcan, left hand, two-hand signs) rely on the rules.
- Trained model (`model.js` + `static/translator/model/gesture_mlp.json`; 2D landmark features only, depth is not used): a small neural network trained by `ml/train.py` on `ml/data/synthetic_landmarks.npz`. It is fused with the rules and Google's classifier: agreement keeps the sign, a confident disagreement becomes UNKNOWN, and a very confident model can fill in when the rules are unsure.
- When two hands are visible only the two-hand rules apply; otherwise a pose it is unsure about is UNKNOWN.
- A sign is accepted after 6 of the last 10 frames agree AND it is held 2 s (a hand dropout shorter than 0.4 s does not restart the hold); the same sign needs a release before it repeats.
- Add `?debug=1` to any page URL to overlay the live readings of all three methods on the camera view. On `/practice/?debug=1` a report table appears (per sign: how often rules / Google / trained model / combined were right); use *Copy report* to share it.
- Spurious second-hand detections no longer block single-hand signs: if the two hands are not a two-hand sign, each hand is read alone (a clearly larger hand wins over a smaller one).
- Checked against a simulated 3D hand model (random rotation, left/right hands, noise): single-hand frame accuracy ~99 % at 0.25 cm
  landmark noise; see ml/report.txt and the numbers in the chat summary.

Debug: open any camera page with `?debug=1` (for example `/?debug=1`) to overlay the live readings (finger states T/I/M/R/P, thumb and spread values, raw label).

Machine learning (`ml/`)
- `python ml/make_dataset.py` rebuilds the synthetic dataset (see `ml/DATASET.md`); `python ml/train.py` trains and exports the browser model + `ml/report.txt`.
- `/collect/` (hidden page) records REAL landmark samples; export the JSON into `ml/data/real/` and run `python ml/train.py --real "data/real/*.json"`.
- `pip install -r ml/requirements-ml.txt` (numpy, scikit-learn) – separate from the Django requirements.

See `SIGNS.md` for the full list of signs and meanings.
