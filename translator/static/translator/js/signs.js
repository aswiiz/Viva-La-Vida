// Custom gesture vocabulary for Viva La Vida. Custom gestures, NOT asserted to be standard ISL.
// id: class id | e: emoji | n: name | w: word added to the sentence | m: meaning | c: dictionary group
// how: how to make it (matches the recognition rules) | two: needs two hands | note: caveat
export const SIGNS = [
 {id:'fist',      e:'✊', n:'Fist',               w:'Hello',        m:'Hello / Goodbye',                           c:'Fists & thumbs', how:'Closed fist, hand upright (fingers pointing up or down).'},
 {id:'fist_l',    e:'🤛', n:'Left-facing fist',   w:'Cheers',       m:'Fist bump / Cheers',                        c:'Fists & thumbs', how:'Closed fist with the hand turned sideways so the knuckles face the LEFT of the screen.', note:'A fist facing right is not a sign.'},
 {id:'thumb_up',  e:'👍', n:'Thumbs up',          w:'Good job',     m:'Approval / Good job / Agreement',           c:'Fists & thumbs', how:'Fist with the thumb straight up.'},
 {id:'thumb_dn',  e:'👎', n:'Thumbs down',        w:'Bad',          m:'Disapproval / Bad / Disagreement',          c:'Fists & thumbs', how:'Fist with the thumb straight down.'},
 {id:'one_up',    e:'☝️', n:'Index up',           w:'One',          m:'Number 1 / Attention / Look up',            c:'Pointing',       how:'Index finger pointing up, other fingers folded.'},
 {id:'one_dn',    e:'👇', n:'Index down',         w:'Look down',    m:'Look down / Pointing down',                 c:'Pointing',       how:'Index finger pointing down, other fingers folded.'},
 {id:'one_l',     e:'👈', n:'Point left',         w:'Left',         m:'Left / Pointing left',                      c:'Pointing',       how:'Index finger pointing to the left of the screen, other fingers folded.'},
 {id:'one_r',     e:'👉', n:'Point right',        w:'Right',        m:'Right / Pointing right',                    c:'Pointing',       how:'Index finger pointing to the right of the screen, other fingers folded.'},
 {id:'victory',   e:'✌️', n:'Two fingers (V)',    w:'Peace',        m:"Peace / Victory / ASL letter 'V'",          c:'Finger shapes',  how:'Index and middle fingers up in a clear V; ring and pinky folded.'},
 {id:'cross',     e:'🤞', n:'Crossed fingers',    w:'Good luck',    m:"Hope / Good luck / ASL letter 'R'",         c:'Finger shapes',  how:'Index and middle fingers up and crossed (or touching); ring and pinky folded.'},
 {id:'love',      e:'🤟', n:'I love you',         w:'I love you',   m:'I love you',                                c:'Finger shapes',  how:'Thumb, index and pinky out; middle and ring folded.'},
 {id:'horns',     e:'🤘', n:'Rock sign',          w:'Rock on',      m:'Rock on / Horns / Metal salute',            c:'Finger shapes',  how:'Index and pinky up; middle and ring folded; thumb folded.'},
 {id:'call',      e:'🤙', n:'Call me',            w:'Call me',      m:"Call me / Shaka / Hang loose / ASL letter 'Y'", c:'Finger shapes', how:'Thumb and pinky out; the other three fingers folded.'},
 {id:'three',     e:'3️⃣', n:'Three fingers',      w:'Three',        m:'Number 3',                                  c:'Finger shapes',  how:'Index, middle and ring up; pinky and thumb folded.'},
 {id:'four',      e:'4️⃣', n:'Four fingers',       w:'Four',         m:'Number 4',                                  c:'Finger shapes',  how:'Index, middle, ring and pinky up; thumb folded across the palm.'},
 {id:'palm',      e:'✋', n:'Raised hand',         w:'Stop',         m:'Stop / Wait',                               c:'Open hand',      how:'Open upright hand, all five fingers extended.'},
 {id:'vulcan',    e:'🖖', n:'Vulcan salute',      w:'Live long and prosper', m:'Live long and prosper',            c:'Open hand',      how:'Four fingers up and split in two pairs: index+middle together, ring+pinky together, a clear V between middle and ring.'},
 {id:'left_hand', e:'🫲', n:'Leftwards hand',     w:'Please',       m:'Please / Give me / Offer',                  c:'Open hand',      how:'Open hand held sideways with the fingers pointing to the left of the screen.'},
 {id:'both_palm', e:'🙌', n:'Raising hands',      w:'Celebrate',    m:'High-five / Celebrate / Hooray',            c:'Two hands',      two:1, how:'BOTH hands open and raised, fingers up, held clearly apart from each other.'}
];
export const BY_ID = Object.fromEntries(SIGNS.map(s => [s.id, s]));
