// The CrazyGames build's entry: the portal's SDK first (its saves have to be
// there before the game reads them), then the game itself.
import { initPlatform, platform } from './platform.js';

initPlatform()
  .catch(() => {})
  .then(() => {
    platform.loadingStart();
    return import('./main.js');
  });
