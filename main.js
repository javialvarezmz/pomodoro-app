// main.js – Pomodoro App (temporizador accesible con estados y persistencia)

(function () {
  const timeDisplay = document.getElementById("time-display");
  const phaseDisplay = document.getElementById("phase-display");
  const startPauseBtn = document.getElementById("start-pause-btn");
  const resetBtn = document.getElementById("reset-btn");
  const nextBtn = document.getElementById("next-btn");
  const msgBox = document.getElementById("messages");

  const workInput = document.getElementById("work-duration");
  const breakInput = document.getElementById("break-duration");

  // Sonido al acabar fase (elige formato soportado)
  const beep = new Audio();
  beep.src = beep.canPlayType("audio/ogg") ? "assets/tibel.ogg" : "assets/tibel.mp3";
  function fallbackBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      o.start();
      setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.01); o.stop(); ctx.close(); }, 300);
    } catch {}
  }

  // Estado global
  let phase = "work"; // "work" | "break"
  let running = false;
  let targetTime = null;
  let timerInterval = null;
  let remainingMs = null;

  // Wake Lock para evitar que la pantalla se duerma en móvil
  let wakeLock;
  async function requestWakeLock() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }
  function releaseWakeLock() { try { wakeLock?.release(); wakeLock = null; } catch {} }

  // Duraciones (ms)
  function getDurations() {
    const workMin = parseInt(workInput.value, 10) || 25;
    const breakMin = parseInt(breakInput.value, 10) || 5;
    return { work: workMin * 60 * 1000, break: breakMin * 60 * 1000 };
  }

  function saveDurations() {
    localStorage.setItem("pomodoro-durations", JSON.stringify({
      work: workInput.value,
      break: breakInput.value,
    }));
  }

  function loadDurations() {
    const data = localStorage.getItem("pomodoro-durations");
    if (!data) return;
    try {
      const obj = JSON.parse(data);
      if (obj.work) workInput.value = obj.work;
      if (obj.break) breakInput.value = obj.break;
    } catch (_) {}
  }

  // Render del tiempo restante
  function render(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    timeDisplay.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    phaseDisplay.textContent = phase === "work" ? "Trabajo" : "Descanso";
    document.body.setAttribute("data-phase", phase);
    // título dinámico en la pestaña
    document.title = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")} · Pomodoro`;
  }

  // Cambiar de fase
  function switchPhase() {
    phase = phase === "work" ? "break" : "work";
    msgBox.textContent = phase === "work" ? "¡Hora de concentrarse!" : "¡Toca descansar!";
    beep.play().catch(() => fallbackBeep()); // fallback si el navegador bloquea el autoplay
    // Notificación al terminar la fase
    if ('Notification' in window && Notification.permission === 'granted') {
      const body = phase === 'work' ? '¡Hora de concentrarse!' : '¡Toca descansar!';
      new Notification('Fin de fase', { body, silent: true });
    }
    startTimer();
  }

  // Iniciar temporizador
  function startTimer() {
    const durations = getDurations();
    const duration = phase === "work" ? durations.work : durations.break;

    targetTime = Date.now() + duration;
    running = true;
    startPauseBtn.textContent = "⏸️ Pausar";

    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 500);
    tick();
    requestWakeLock();
    setButtons();
  }

  // Pausar
  function pauseTimer() {
    running = false;
    clearInterval(timerInterval);
    remainingMs = targetTime - Date.now();
    startPauseBtn.textContent = "▶️ Reanudar";
    msgBox.textContent = "Temporizador en pausa";
    releaseWakeLock();
    setButtons();
  }

  // Reanudar
  function resumeTimer() {
    running = true;
    targetTime = Date.now() + remainingMs;
    startPauseBtn.textContent = "⏸️ Pausar";
    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 500);
    tick();
    requestWakeLock();
    setButtons();
  }

  // Resetear
  function resetTimer() {
    running = false;
    clearInterval(timerInterval);
    const durations = getDurations();
    const duration = phase === "work" ? durations.work : durations.break;
    render(duration);
    startPauseBtn.textContent = "▶️ Iniciar";
    msgBox.textContent = "Temporizador reiniciado";
    releaseWakeLock();
    setButtons();
  }

  function setButtons() {
    const active = running || !!remainingMs;
    resetBtn.disabled = !active;
    nextBtn.disabled  = !active;
  }

  // Tick
  function tick() {
    const msLeft = targetTime - Date.now();
    if (msLeft <= 0) {
      clearInterval(timerInterval);
      render(0);
      switchPhase();
      return;
    }
    render(msLeft);
  }

  // Botones
  startPauseBtn.addEventListener("click", () => {
    if (!running && !remainingMs) {
      startTimer();
    } else if (running) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  });

  resetBtn.addEventListener("click", () => {
    remainingMs = null;
    resetTimer();
  });

  nextBtn.addEventListener("click", () => {
    switchPhase();
  });

  // Guardar duraciones
  [workInput, breakInput].forEach((input) => {
    input.addEventListener("change", saveDurations);
  });

  // Atajos de teclado
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      startPauseBtn.click();
    }
    if (e.key.toLowerCase() === "r") {
      resetBtn.click();
    }
  });

  // Inicialización
  // Pedir permiso de notificaciones (si aplica)
  document.addEventListener('DOMContentLoaded', () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  });
  loadDurations();
  resetTimer();
  setButtons();
})();