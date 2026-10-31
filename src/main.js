// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
// Deep links: #iron-rain, #the-jackal ... or #chapter-1 to #chapter-5 skip the title screen.
const HASHES = { 'the-helldiver': 1, 'the-passage': 2, 'war-of-houses': 3, 'the-jackal': 4, 'iron-rain': 5 };
function chapterFromHash() {
  const h = location.hash.slice(1).toLowerCase();
  const m = h.match(/^chapter-([1-5])$/);
  return m ? +m[1] : HASHES[h] || 0;
}
scene = new TitleScene();
scene.enter();
if (chapterFromHash()) startChapter(chapterFromHash());
addEventListener('hashchange', () => { if (chapterFromHash()) startChapter(chapterFromHash()); });
requestAnimationFrame((t) => { last = t; frame(t); });
// Small handle for automated smoke tests.
window.__btc = { keys, touch, pollInput, I, go, startChapter, chapterWon, FOES, CARDS, Save, TitleScene, MineScene, DuelScene, InstituteScene, RainScene, Ranks, Music, StoryScene, CreditsScene, get scene() { return scene; } };
