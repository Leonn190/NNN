(() => {
'use strict';

function createElectrical() {
  let fault = false;
  let pending = false;
  let switchedOff = false;

  return {
    failed: () => fault && !pending,
    reveal() { pending = false; },
    trip(deferred = false) {
      if (fault) return false;
      fault = true;
      pending = deferred;
      switchedOff = false;
      return true;
    },
    powerChanged(wasOn, isOn) {
      if (!fault || pending || wasOn === isOn) return false;
      if (!isOn) switchedOff = true;
      if (!isOn || !switchedOff) return false;
      fault = switchedOff = false;
      return true;
    }
  };
}

window.NathGame.createElectrical = createElectrical;
})();
