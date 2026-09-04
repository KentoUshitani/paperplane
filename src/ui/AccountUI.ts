import type { Session, User } from "@supabase/supabase-js";
import {
  fetchLeaderboard,
  getDisplayName,
  getSessionUser,
  isSupabaseConfigured,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  submitScoreRecord,
  supabase,
  type ScoreRow,
} from "../lib/auth";

type AuthMode = "signin" | "signup";

/** How many leaderboard slots to show (Top N). */
const RANK_SLOTS = 10;

/**
 * HTML overlays for login + global leaderboard (Supabase free tier).
 */
export class AccountUI {
  private readonly root: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly authModal: HTMLElement;
  private readonly rankModal: HTMLElement;
  private readonly authForm: HTMLFormElement;
  private readonly authMsg: HTMLElement;
  private readonly rankList: HTMLElement;
  private readonly rankMsg: HTMLElement;
  private readonly nameField: HTMLInputElement;
  private readonly emailField: HTMLInputElement;
  private readonly passwordField: HTMLInputElement;
  private readonly authTitle: HTMLElement;
  private readonly toggleAuthBtn: HTMLButtonElement;
  private readonly submitAuthBtn: HTMLButtonElement;

  private user: User | null = null;
  private mode: AuthMode = "signin";
  private onBlockChange: ((blocked: boolean) => void) | null = null;
  private authUnsub: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.statusEl = this.must("#account-status");
    this.authModal = this.must("#modal-auth");
    this.rankModal = this.must("#modal-ranking");
    this.authForm = this.must("#auth-form") as HTMLFormElement;
    this.authMsg = this.must("#auth-msg");
    this.rankList = this.must("#rank-list");
    this.rankMsg = this.must("#rank-msg");
    this.nameField = this.must("#auth-name") as HTMLInputElement;
    this.emailField = this.must("#auth-email") as HTMLInputElement;
    this.passwordField = this.must("#auth-password") as HTMLInputElement;
    this.authTitle = this.must("#auth-title");
    this.toggleAuthBtn = this.must("#auth-toggle") as HTMLButtonElement;
    this.submitAuthBtn = this.must("#auth-submit") as HTMLButtonElement;

    this.bind();
    void this.init();
  }

  setBlockHandler(handler: (blocked: boolean) => void): void {
    this.onBlockChange = handler;
  }

  get currentUser(): User | null {
    return this.user;
  }

  dispose(): void {
    this.authUnsub?.();
  }

  /** Call on game over / clear to sync cloud score when logged in. */
  async syncScore(depth: number, stage: number): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const fresh = await getSessionUser();
      if (!fresh) return;
      this.user = fresh;
      await submitScoreRecord(depth, stage, getDisplayName(fresh));
    } catch (err) {
      console.warn("Failed to submit score", err);
    }
  }

  private must<T extends HTMLElement = HTMLElement>(sel: string): T {
    const el = this.root.querySelector(sel);
    if (!(el instanceof HTMLElement)) throw new Error(`Missing ${sel}`);
    return el as T;
  }

  private bind(): void {
    this.root.querySelector("#btn-login")?.addEventListener("click", () => {
      if (!isSupabaseConfigured) {
        this.openAuth("Supabase の .env 設定が必要です");
        return;
      }
      if (this.user) void this.handleSignOut();
      else this.openAuth();
    });

    this.root.querySelector("#btn-ranking")?.addEventListener("click", () => {
      void this.openRanking();
    });

    this.root.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => this.closeModals());
    });

    this.toggleAuthBtn.addEventListener("click", () => {
      this.mode = this.mode === "signin" ? "signup" : "signin";
      this.renderAuthMode();
    });

    this.authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      void this.handleEmailAuth();
    });

    this.root.querySelector("#btn-google")?.addEventListener("click", () => {
      void this.handleGoogle();
    });

    // Allow typing in modal without game eating keys
    for (const modal of [this.authModal, this.rankModal]) {
      modal.addEventListener("keydown", (e) => e.stopPropagation());
      modal.addEventListener("keyup", (e) => e.stopPropagation());
    }
  }

  private async init(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      this.statusEl.textContent = "OFFLINE";
      const loginBtn = this.root.querySelector("#btn-login");
      if (loginBtn) loginBtn.textContent = "SETUP";
      return;
    }

    this.user = await getSessionUser();
    this.renderAccount();

    const { data } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        this.user = session?.user ?? null;
        this.renderAccount();
        if (this.user) this.closeModals();
      },
    );
    this.authUnsub = () => data.subscription.unsubscribe();
  }

  private renderAccount(): void {
    const loginBtn = this.root.querySelector("#btn-login");
    if (!isSupabaseConfigured) {
      this.statusEl.textContent = "OFFLINE";
      if (loginBtn) loginBtn.textContent = "SETUP";
      return;
    }
    if (this.user) {
      this.statusEl.textContent = getDisplayName(this.user);
      if (loginBtn) loginBtn.textContent = "LOGOUT";
    } else {
      this.statusEl.textContent = "GUEST";
      if (loginBtn) loginBtn.textContent = "LOGIN";
    }
  }

  private setBlocked(blocked: boolean): void {
    this.onBlockChange?.(blocked);
  }

  private openAuth(msg = ""): void {
    this.mode = "signin";
    this.renderAuthMode();
    this.authMsg.textContent = msg;
    this.authModal.hidden = false;
    this.rankModal.hidden = true;
    this.setBlocked(true);
    this.emailField.focus();
  }

  private async openRanking(): Promise<void> {
    this.authModal.hidden = true;
    this.rankModal.hidden = false;
    this.setBlocked(true);
    this.rankList.innerHTML = "";
    this.rankMsg.textContent = isSupabaseConfigured
      ? "Loading..."
      : "Supabase 未設定（.env を確認）";

    if (!isSupabaseConfigured) return;

    try {
      const rows = await fetchLeaderboard(RANK_SLOTS);
      this.renderRanking(rows);
      this.rankMsg.textContent =
        rows.length === 0 ? "まだスコアがありません" : "";
    } catch (err) {
      this.rankMsg.textContent =
        err instanceof Error ? err.message : "読み込みに失敗しました";
    }
  }

  private renderRanking(rows: ScoreRow[]): void {
    this.rankList.innerHTML = "";
    for (let i = 0; i < RANK_SLOTS; i++) {
      const row = rows[i];
      const li = document.createElement("li");
      if (row) {
        const mine = this.user?.id === row.user_id;
        li.className = mine ? "rank-row mine" : "rank-row";
        li.innerHTML = `
          <span class="rank-pos">${i + 1}</span>
          <span class="rank-name">${escapeHtml(row.display_name)}</span>
          <span class="rank-stage">S${row.stage}</span>
          <span class="rank-depth">${row.depth}m</span>
        `;
      } else {
        li.className = "rank-row empty";
        li.innerHTML = `
          <span class="rank-pos">${i + 1}</span>
          <span class="rank-name">---</span>
          <span class="rank-stage">-</span>
          <span class="rank-depth">-</span>
        `;
      }
      this.rankList.appendChild(li);
    }
  }

  private closeModals(): void {
    this.authModal.hidden = true;
    this.rankModal.hidden = true;
    this.setBlocked(false);
  }

  private renderAuthMode(): void {
    const signup = this.mode === "signup";
    this.authTitle.textContent = signup ? "SIGN UP" : "LOGIN";
    this.submitAuthBtn.textContent = signup ? "CREATE" : "LOGIN";
    this.toggleAuthBtn.textContent = signup
      ? "アカウントあり → LOGIN"
      : "新規登録 → SIGN UP";
    this.nameField.hidden = !signup;
    this.nameField.required = signup;
    this.authMsg.textContent = "";
  }

  private async handleEmailAuth(): Promise<void> {
    if (!isSupabaseConfigured) return;
    const email = this.emailField.value.trim();
    const password = this.passwordField.value;
    const name = this.nameField.value.trim() || "PILOT";
    this.authMsg.textContent = "...";
    try {
      if (this.mode === "signin") {
        await signInWithEmail(email, password);
        this.authMsg.textContent = "ログインしました";
      } else {
        const data = await signUpWithEmail(email, password, name);
        if (data.session) {
          this.authMsg.textContent = "登録完了";
        } else {
          this.authMsg.textContent =
            "確認メールを送った場合はリンクを開いてください（ダッシュボードで Confirm email をオフにすると即プレイ可）";
        }
      }
    } catch (err) {
      this.authMsg.textContent =
        err instanceof Error ? err.message : "認証に失敗しました";
    }
  }

  private async handleGoogle(): Promise<void> {
    if (!isSupabaseConfigured) {
      this.authMsg.textContent = "Supabase 未設定";
      return;
    }
    try {
      await signInWithGoogle();
    } catch (err) {
      this.authMsg.textContent =
        err instanceof Error ? err.message : "Google ログインに失敗";
    }
  }

  private async handleSignOut(): Promise<void> {
    try {
      await signOut();
    } catch (err) {
      console.warn(err);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
