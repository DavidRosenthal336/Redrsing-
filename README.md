# Break the Chains

An unofficial, non-commercial fan game inspired by Pierce Brown's *Red Rising*. It follows Darrow from the mines of Lykos to the snows below Olympus, in five chapters that each play differently.

**Play:** open `index.html` in any modern browser (desktop or phone, landscape). No install, no build step needed to play.

## Chapters

| | Chapter | How it plays |
|---|---|---|
| I | **The Helldiver** | Pilot a clawDrill through a procedurally generated mine. Dig helium-3 against the clock and beat Gamma clan. Hidden gas pockets explode unless you drill carefully; pitvipers hunt you through the tunnels; the drill overheats; a sonar ping reveals veins in the dark. The richest vein lies deepest, ringed with gas. |
| II | **The Passage** | A one-on-one duel with Julian au Bellona. Strike, block, parry (tap block as the blow lands), dodge, and watch for red glints: heavy blows that break blocks. |
| III | **War of Houses** | Top-down conquest of the Institute highlands with Sevro, Pax, Quinn and Roque at your back. Take the castles of Ceres, Minerva, Diana and Jupiter by clearing defenders and holding their standard. Captured students are freed and join you. Winter falls. Then storm Olympus and beat Proctor Apollo. |
| IV | **The Jackal** | A harder duel on the frozen ridge. The Jackal feints, throws knives (parry them back), and gets faster when wounded. |
| V | **Iron Rain** | Years later, from *Morning Star*: free-fall from orbit in a starShell. Dodge flak and debris, shoot down ripWings and missiles, gather falling soldiers into your stick, grab repair cells, and steer for the drop zone. |

Every chapter grades you on the Society's own Color scale (Gold, Silver, Copper, Grey, Red). Your best rank shows on Chapter Select.

Each chapter has its own original soundtrack, played by a small step sequencer in the browser (toggle in the title or pause menu).

Story cards between chapters cover Eo, the Laurel, the Sons of Ares, the Color hierarchy, the Carving and the Institute.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / Arrows | Left stick |
| A (ping / strike / confirm) | J, Space, Z, Enter | Red button |
| B (careful drill / block / dash) | K, Shift, X | Gold button |
| Dodge (duels) | W / Up | Stick up |
| Pause | Esc / P | II button |
| Mute | M | Pause menu |

Progress (unlocked chapters) is saved in your browser.

## Balance testing

`tools/` holds Playwright scripts that drive the real game with bots: `duelbot.js` fights both duels at three skill levels, `minebot.js` runs a pathfinding Helldiver, `rainbot.js` dives the Iron Rain, and `smoke.js` visits every scene and checks for errors. Run them with `node tools/duelbot.js` (needs `playwright` installed). Current targets: a sloppy duelist beats the Jackal about 40% of the time and a good one always does; an all-seeing mine bot hauls ~300 kg against Gamma's ~100.

## Building

Source lives in `src/`. `./build.sh` concatenates it into `index.html` (standalone page) and `dist/break-the-chains.html` (body-only variant). Everything — art, music, sound — is drawn and synthesized in code; there are no asset files.

## Credit

*Red Rising* and its characters belong to Pierce Brown. This is a fan tribute and is not affiliated with or endorsed by the author or publisher.
