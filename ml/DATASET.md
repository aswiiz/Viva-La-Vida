# Dataset card – `data/synthetic_landmarks.npz`

**What it is:** 28,800 *synthetic* hand samples (30 simulated people × 18 single-hand signs × 40 + 240 "none" samples per person).
Each sample is the 40-number feature vector of one hand (x,y of the 20 landmarks, wrist-centred, divided by palm length; depth z is not used)
- exactly what `static/translator/js/model.js` computes in the browser.

**How it was made:** `handsim.py` = a 3D forward-kinematics hand with per-person anatomy (finger lengths, palm width, habits),
left/right hand, palm/back facing, rotation (roll/yaw/pitch), landmark noise 0.15–0.5 cm and z-scale error.
Re-create with `python make_dataset.py` (seed 7).

**Classes (19):** fist, fist_l, thumb_up, thumb_dn, one_up, one_dn, one_l, one_r, victory, cross, love, horns, call, three, four,
palm, vulcan, left_hand, **none** (random finger combinations, relaxed hands, half-way blends, wrong orientations).
The two-hand sign 🙌 is decided by rules from two open-hand detections.

**Honest limits:** this is simulated, not recorded from people. It teaches the model my assumptions about how the signs
look; real hands/cameras differ. Use the `/collect/` page to record real samples and retrain:
`python train.py --real "data/real/*.json"` (real samples are weighted ×3). More real, varied data = more real accuracy.

**Measured (see `report.txt`):** see report.txt (accuracy on 6 simulated people never seen in training).
