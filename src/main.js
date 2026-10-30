// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
scene = new TitleScene();
scene.enter();
requestAnimationFrame((t) => { last = t; frame(t); });
// Small handle for automated smoke tests.
window.__btc = { keys, touch, pollInput, I, go, startChapter, chapterWon, FOES, CARDS, Save, TitleScene, MineScene, DuelScene, InstituteScene, RainScene, Ranks, Music, StoryScene, CreditsScene, get scene() { return scene; } };
