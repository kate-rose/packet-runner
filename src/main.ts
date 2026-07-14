import "./style.css";
import { Engine } from "./engine";
import { story } from "./story/story";
import { newGameState, loadGame, clearSave } from "./state";

function showTitle(): void {
  const game = document.getElementById("game")!;
  const title = document.createElement("div");
  title.id = "title-screen";
  const save = loadGame();
  title.innerHTML = `
    <div class="title-inner">
      <div class="title-logo">PACKET&nbsp;RUNNER</div>
      <div class="title-tag">A story about who knows what.</div>
      <div class="title-buttons">
        <button id="btn-new">${save ? "New Run" : "Start"}</button>
        ${save ? '<button id="btn-continue">Continue</button>' : ""}
      </div>
      <div class="title-hint">Click or press Space to continue &middot; open your <b>&#9638;&nbsp;TILE</b> anytime to see who knows what &middot; <b>&#9834;</b> mutes sound</div>
      <div class="title-credit">by Kate Bertash &middot; Part 1</div>
    </div>`;
  game.appendChild(title);

  document.getElementById("btn-new")!.addEventListener("click", () => {
    clearSave();
    title.remove();
    const e = new Engine(story, newGameState(), 0);
    (window as unknown as { __pr: Engine }).__pr = e; // dev: scene-jump via __pr.debugJump("label")
    e.start();
  });
  const cont = document.getElementById("btn-continue");
  if (cont) {
    cont.addEventListener("click", () => {
      const s = loadGame()!;
      title.remove();
      const e = new Engine(story, s.state, s.pc);
      (window as unknown as { __pr: Engine }).__pr = e;
      e.start();
    });
  }
}

// inject minimal title styling (kept here to keep style.css scene-focused)
const style = document.createElement("style");
style.textContent = `
#title-screen{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at center,#15100a,#000);}
.title-inner{text-align:center;}
.title-logo{font-size:clamp(28px,6vw,64px);letter-spacing:0.18em;color:#ffd27f;
  text-shadow:0 0 24px rgba(255,200,120,0.5);}
.title-tag{margin-top:14px;color:#c79a52;letter-spacing:0.1em;font-size:clamp(12px,1.8vw,18px);}
.title-buttons{margin-top:38px;display:flex;gap:16px;justify-content:center;}
.title-buttons button{font-family:inherit;font-size:clamp(13px,1.7vw,18px);color:#ffd27f;background:rgba(18,14,9,0.9);
  border:1px solid #4a3a1f;border-radius:6px;padding:12px 28px;cursor:pointer;transition:all .12s;}
.title-buttons button:hover{border-color:#ffd27f;box-shadow:0 0 16px rgba(255,200,120,0.3);}
.title-hint{margin-top:34px;color:#8a7140;font-size:12px;letter-spacing:0.04em;max-width:560px;line-height:1.7;margin-left:auto;margin-right:auto;}
.title-hint b{color:#c79a52;font-weight:600;}
.title-credit{margin-top:18px;color:#6b5a3a;font-size:12px;letter-spacing:0.15em;}
`;
document.head.appendChild(style);

showTitle();
