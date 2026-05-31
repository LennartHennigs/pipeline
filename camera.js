import { T } from './i18n.js';
import { EL } from './dom.js';
import { showToast } from './utils.js';

let _cameraStream = null;
let _detector     = null; // lazily created; reused across camera sessions
let _scanGen      = 0;    // invalidates stale scan loops on rapid open/close

export async function startCameraQR() {
  try {
    const gen = ++_scanGen;
    _cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    EL.cameraVideo.srcObject = _cameraStream;
    EL.cameraOverlay.style.display = 'flex';
    if (!_detector) _detector = new BarcodeDetector({ formats: ['qr_code'] });
    const scan = async () => {
      if (_cameraStream === null || _scanGen !== gen) return;
      try {
        const codes = await _detector.detect(EL.cameraVideo);
        for (const bc of codes) {
          try {
            const u    = new URL(bc.rawValue);
            const code = u.searchParams.get('join');
            if (code) { EL.joinCodeInput.value = code.toUpperCase(); stopCamera(); return; }
          } catch (e) { console.warn('QR URL parse:', e); }
        }
      } catch (e) { console.warn('BarcodeDetector:', e); }
      if (_cameraStream !== null && _scanGen === gen) setTimeout(scan, 250);
    };
    scan();
  } catch { showToast(T('cameraUnsupported')); }
}

export function stopCamera() {
  if (_cameraStream) { _cameraStream.getTracks().forEach(t => t.stop()); _cameraStream = null; }
  EL.cameraOverlay.style.display = 'none';
  EL.cameraVideo.srcObject = null;
}
