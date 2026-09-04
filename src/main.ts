import { Game } from "./game/Game";
import { AccountUI } from "./ui/AccountUI";

const app = document.getElementById("app");
const canvas = document.getElementById("game");
if (!(app instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#app / #game not found");
}

const game = new Game(canvas);
const account = new AccountUI(app);

account.setBlockHandler((blocked) => game.setUiBlocked(blocked));
game.onScoreCommit = (depth, stage) => {
  void account.syncScore(depth, stage);
};

const muteBtn = document.getElementById("btn-mute");
const syncMuteLabel = () => {
  if (!(muteBtn instanceof HTMLButtonElement)) return;
  muteBtn.textContent = game.audio.isMuted ? "MUTE" : "BGM";
  muteBtn.classList.toggle("muted", game.audio.isMuted);
};
syncMuteLabel();
muteBtn?.addEventListener("click", () => {
  void game.audio.unlock().then(() => {
    game.audio.toggleMute();
    if (!game.audio.isMuted) void game.audio.startMusic(0.35);
    syncMuteLabel();
  });
});

game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    account.dispose();
    game.dispose();
  });
}
