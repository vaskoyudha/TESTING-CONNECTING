// === 1) Konfigurasi Firebase (isi dari Project Settings → General) ===
const firebaseConfig = {
  apiKey: "AIzaSyCHpITmPUoKIb2niuh0G4vhJJJ0vBM2ijE",
  authDomain: "esp32kursi-pintar.firebaseapp.com",        // ← isi (opsional untuk RTDB, tapi bagus diisi)
  databaseURL: "https://esp32kursi-pintar-default-rtdb.firebaseio.com",
  projectId: "esp32kursi-pintar",                          // ← isi
  storageBucket: "esp32kursi-pintar.appspot.com",          // ← opsional
  messagingSenderId: "265798521874",                   // ← opsional
  appId: "1:265798521874:web:6097e5ae6ccf8ad683b4cb",                                  // ← isi
};

// === 2) Init app, auth anon, dan database ===
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// UI refs
const wifiStatus    = document.getElementById('wifiStatus');
const authStatus    = document.getElementById('authStatus');
const deviceStatus  = document.getElementById('deviceStatus');
const deviceIdInput = document.getElementById('deviceId');
const saveDeviceBtn = document.getElementById('saveDeviceBtn');
const fsrVal        = document.getElementById('fsrVal');
const punggungVal   = document.getElementById('punggungVal');
const leherVal      = document.getElementById('leherVal');
const lastUpdateEl  = document.getElementById('lastUpdate');
const serialLastEl  = document.getElementById('serialLast');
const serialLogsBody= document.getElementById('serialLogsBody');

// === 3) Status jaringan sederhana ===
function setWifiStatus(online){
  wifiStatus.textContent = `WiFi: ${online ? 'Online' : 'Offline'}`;
  wifiStatus.style.color = online ? '#79f2c0' : '#ff7a7a';
}
setWifiStatus(navigator.onLine);
window.addEventListener('online',  () => setWifiStatus(true));
window.addEventListener('offline', () => setWifiStatus(false));

// === 4) Chart.js setup ===
const ctx = document.getElementById('liveChart');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { label: 'FSR',           data: [], tension: .25 },
      { label: 'Punggung (cm)', data: [], tension: .25 },
      { label: 'Leher (cm)',    data: [], tension: .25 },
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#e7eefc' } } },
    scales: {
      x: { ticks: { color: '#9fb0d3' }, grid: { color: 'rgba(255,255,255,.06)' } },
      y: { ticks: { color: '#9fb0d3' }, grid: { color: 'rgba(255,255,255,.06)' } }
    }
  }
});
function pushChart(tsLabel, fsr, back, neck){
  const maxPoints = 120; // ~2 menit bila update per 1s
  chart.data.labels.push(tsLabel);
  chart.data.datasets[0].data.push(fsr);
  chart.data.datasets[1].data.push(back);
  chart.data.datasets[2].data.push(neck);
  if(chart.data.labels.length > maxPoints){
    chart.data.labels.shift();
    chart.data.datasets.forEach(d => d.data.shift());
  }
  chart.update();
}

// === 5) Helper: ambil deviceId dari localStorage atau autodetect ===
async function resolveDeviceId(){
  let dev = localStorage.getItem('deviceId') || deviceIdInput.value.trim();
  if (dev) return dev;

  const snap = await db.ref('/devices').limitToFirst(1).get();
  if (snap.exists()) {
    const firstKey = Object.keys(snap.val())[0];
    deviceIdInput.value = firstKey;
    localStorage.setItem('deviceId', firstKey);
    return firstKey;
  }
  return null;
}

// === 6) Pasang listener ke live & serial path ===
let liveRef=null, serialLastRef=null, serialLogsRef=null;
function detachAll(){
  if(liveRef) liveRef.off();
  if(serialLastRef) serialLastRef.off();
  if(serialLogsRef) serialLogsRef.off();
}
async function attachForDevice(deviceId){
  detachAll();
  if(!deviceId){
    deviceStatus.textContent = 'Device: tidak ditemukan';
    deviceStatus.style.color = '#ff7a7a';
    return;
  }
  deviceStatus.textContent = `Device: ${deviceId}`;
  deviceStatus.style.color = '#79f2c0';

  liveRef       = db.ref(`/devices/${deviceId}/live`);
  serialLastRef = db.ref(`/devices/${deviceId}/serial/last`);
  serialLogsRef = db.ref(`/devices/${deviceId}/serial/logs`).limitToLast(50);

  liveRef.on('value', (snap)=>{
    const v = snap.val();
    if(!v) return;
    const ts  = v.ts ?? null;
    const fsr = v.fsr ?? null;
    const back = v.ultrasonic?.punggung_cm ?? null;
    const neck = v.ultrasonic?.leher_cm ?? null;

    fsrVal.textContent      = fsr ?? '—';
    punggungVal.textContent = (back === -1 || back == null) ? '—' : Number(back).toFixed(2);
    leherVal.textContent    = (neck === -1 || neck == null) ? '—' : Number(neck).toFixed(2);
    lastUpdateEl.textContent = `Last update: ${new Date().toLocaleTimeString()}`;

    // label waktu untuk grafik
    const label = new Date().toLocaleTimeString();
    pushChart(label, fsr ?? null, back === -1 ? null : back, neck === -1 ? null : neck);
  });

  serialLastRef.on('value', (snap)=>{
    const s = snap.val();
    serialLastEl.textContent = s ?? '—';
  });

  serialLogsRef.on('value', (snap)=>{
    serialLogsBody.innerHTML = '';
    if(!snap.exists()) return;
    const rows = Object.values(snap.val());
    // urutkan by ts naik
    rows.sort((a,b)=> (a.ts??0) - (b.ts??0));
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      const tdTs = document.createElement('td');
      const tdLn = document.createElement('td');
      tdTs.textContent = r.ts ?? '—';
      tdLn.textContent = r.line ?? '';
      tr.appendChild(tdTs); tr.appendChild(tdLn);
      serialLogsBody.appendChild(tr);
    });
    // autoscroll ke bawah
    serialLogsBody.parentElement.scrollTop = serialLogsBody.parentElement.scrollHeight;
  });
}

// === 7) Start: sign-in anonymous lalu attach listeners ===
auth.signInAnonymously()
  .then(async ()=>{
    authStatus.textContent = 'Auth: Anonymous OK';
    authStatus.style.color = '#79f2c0';
    const devId = await resolveDeviceId();
    await attachForDevice(devId);
  })
  .catch(err=>{
    console.error(err);
    authStatus.textContent = 'Auth: gagal';
    authStatus.style.color = '#ff7a7a';
  });

// === 8) Ganti device secara manual ===
saveDeviceBtn.addEventListener('click', async ()=>{
  const id = deviceIdInput.value.trim();
  if(!id) return;
  localStorage.setItem('deviceId', id);
  await attachForDevice(id);
});
