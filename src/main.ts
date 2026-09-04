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

game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    account.dispose();
    game.dispose();
  });
}
