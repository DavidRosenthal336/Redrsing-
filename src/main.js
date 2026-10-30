// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
scene = new TitleScene();
scene.enter();
requestAnimationFrame((t) => { last = t; frame(t); });
// Small handle for automated smoke tests.
window.__btc = { go, startChapter, chapterWon, FOES, CARDS, Save, TitleScene, MineScene, DuelScene, InstituteScene, StoryScene, CreditsScene, get scene() { return scene; } };
