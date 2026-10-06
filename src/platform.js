// The CrazyGames build's link to the portal (its SDK): loading and gameplay
// events, ad breaks, and saves that follow a signed-in player across
// devices. The dev build, any other site, or an ad blocker eating the SDK:
// every call here quietly does nothing, and saves stay in localStorage.
/* global __CG__ */
export const CG = typeof __CG__ !== 'undefined' && __CG__;

// ads are off for now (switched on for the full launch)
const ADS = false;

let sdk = null; // (set once it's up, on CrazyGames or localhost)
let playing = false;
let inAd = false;

export async function initPlatform() {
  if (!CG) return;
  const s = window.CrazyGames?.SDK;
  if (!s) return; // (blocked: play on without it)
  try {
    await s.init();
    if (s.environment === 'crazygames' || s.environment === 'local') sdk = s;
  } catch (err) {
    console.warn('CrazyGames SDK unavailable', err);
  }
}

const call = (fn) => {
  if (!sdk) return;
  try {
    fn(sdk);
  } catch (err) {
    console.warn(err);
  }
};

// Saves: the portal's data store when it's there (synced to the player's
// CrazyGames account), else this browser's. Same calls as localStorage.
function backing() {
  if (sdk?.data) return sdk.data;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
export const store = {
  getItem(k) {
    try {
      return backing()?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  setItem(k, v) {
    try {
      backing()?.setItem(k, v);
    } catch {
      // storage blocked: this session only
    }
  },
  removeItem(k) {
    try {
      backing()?.removeItem(k);
    } catch {
      // (as above)
    }
  },
};

export const platform = {
  loadingStart: () => call((s) => s.game.loadingStart()),
  loadingStop: () => call((s) => s.game.loadingStop()),
  // the game's actually being played (not a menu, pause or end screen):
  // told once per change
  setPlaying(on) {
    if (on === playing || inAd) return;
    playing = on;
    call((s) => (on ? s.game.gameplayStart() : s.game.gameplayStop()));
  },
  get inAd() {
    return inAd;
  },
  // the portal's own mute switch
  get muted() {
    try {
      return !!sdk?.game?.settings?.muteAudio;
    } catch {
      return false;
    }
  },
  // a natural break (a run over, back to the base or going again): the
  // portal may show an ad (it decides how often), then go() carries on
  midgame(go) {
    if (!sdk || !ADS) return void go();
    platform.setPlaying(false);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      inAd = false;
      go();
    };
    inAd = true;
    try {
      sdk.ad.requestAd('midgame', { adStarted: () => (inAd = true), adFinished: finish, adError: finish });
    } catch {
      finish();
    }
  },
};
