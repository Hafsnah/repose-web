// ---------------------------
// RePose - Minimal Pose Demo
// Uses: TensorFlow.js + MoveNet (pose-detection)
// - Draws keypoints
// - Simple rule: "right wrist above right shoulder" => TTS "Bagus!"
// - Debounce speaking to avoid spam
// ---------------------------

let detector = null;
let video = null;
let canvas = null;
let ctx = null;
let isRunning = false;
const lastSpoken = {}; // message->timestamp to debounce
const SPEAK_COOLDOWN = 2000; // ms

// safe speak helper (id-ID)
function speak(text) {
  if (!('speechSynthesis' in window)) {
    console.log('TTS not supported');
    return;
  }
  // debounce same messages
  const now = Date.now();
  if (lastSpoken[text] && now - lastSpoken[text] < SPEAK_COOLDOWN) return;
  lastSpoken[text] = now;

  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'id-ID';
  msg.rate = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(msg);
}

// draw keypoints & skeleton simple
function drawKeypoints(keypoints) {
  keypoints.forEach(k => {
    if (k.score > 0.4) {
      ctx.beginPath();
      ctx.arc(k.x, k.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,30,30,0.9)';
      ctx.fill();
    }
  });
}

// scale keypoint coords to canvas
function scaleKeypoints(kps, videoWidth, videoHeight, canvasWidth, canvasHeight) {
  // pose-detection keypoints use absolute pixel coords if model supports
  // but some versions return normalized coords, so handle both
  return kps.map(k => {
    let x = k.x, y = k.y;
    if (x <= 1 && y <= 1) { // normalized
      x = x * canvasWidth;
      y = y * canvasHeight;
    } else {
      // keypoints might be in video pixels -> need to map to canvas if sizes differ
      const scaleX = canvasWidth / videoWidth;
      const scaleY = canvasHeight / videoHeight;
      x = k.x * scaleX;
      y = k.y * scaleY;
    }
    return { ...k, x, y };
  });
}

// simple rule example: check if right wrist is above right shoulder
function checkRightHandUp(keypoints) {
  const wrist = keypoints.find(k => k.name === 'right_wrist' || k.part === 'right_wrist');
  const shoulder = keypoints.find(k => k.name === 'right_shoulder' || k.part === 'right_shoulder');
  if (!wrist || !shoulder) return { ok: false, reason: 'not_detected' };

  // use y coordinate: smaller y = higher on screen
  if (wrist.y + 10 < shoulder.y) return { ok: true };
  return { ok: false, reason: 'wrist_too_low' };
}

// main detect loop
async function detectPose() {
  if (!isRunning) return;
  try {
    const poses = await detector.estimatePoses(video);
    // draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (poses && poses.length > 0) {
      // use first person
      let kps = poses[0].keypoints;
      // Normalize/scale to canvas coords if needed
      kps = scaleKeypoints(kps, video.videoWidth, video.videoHeight, canvas.width, canvas.height);

      drawKeypoints(kps);

      // example rule: right hand above shoulder
      const check = checkRightHandUp(kps);
      if (check.ok) {
        document.getElementById('log').innerText = 'Detected: Right hand up';
        speak('Bagus! Tangan kananmu sudah terangkat.');
      } else {
        if (check.reason === 'wrist_too_low') {
          document.getElementById('log').innerText = 'Cek: tangan kanan terlalu rendah';
          speak('Coba angkat tangan kanan sedikit lebih tinggi.');
        } else {
          document.getElementById('log').innerText = 'Pose belum terdeteksi jelas';
        }
      }
    } else {
      // no pose
      document.getElementById('log').innerText = 'Belum terdeteksi';
    }
  } catch (err) {
    console.error('detectPose error', err);
    document.getElementById('log').innerText = 'Error deteksi: ' + err.message;
  }

  requestAnimationFrame(detectPose);
}

// initialization
async function init() {
  video = document.getElementById('video');
  canvas = document.getElementById('output');
  ctx = canvas.getContext('2d');

  // request camera
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    alert('Gagal buka kamera: ' + err.message);
    throw err;
  }

  // set canvas size same as video (responsive)
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  // make sure tf backend ready
  await tf.setBackend('webgl');
  await tf.ready();

  // create MoveNet detector (lightning = fast)
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );

  isRunning = true;
  detectPose();
}

// UI hooks
document.getElementById('startBtn').addEventListener('click', async () => {
  if (!isRunning) {
    try {
      await init();
      speak('Selamat datang. Kamera siap, mari mulai latihan.');
    } catch (e) {
      console.error(e);
    }
  } else {
    speak('Sistem sudah berjalan.');
  }
});

document.getElementById('speakTest').addEventListener('click', () => {
  speak('Ini tes suara. Halo, selamat berlatih.');
});
