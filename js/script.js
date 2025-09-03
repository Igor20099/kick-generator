let currentMode = "normal";
let adsrParams = {
  attack: 0,
  decay: 0.1,
  sustain: 0,
  release: 0.3,
};

let durationParams = {
  duration: 0.3,
};

let frequencyParams = {
  minFreq: 100,
  pitchDecay: 0.1,
};

let amplitudeParams = {
  volume: 1,
  saturation: 0.0,
};

let clickParams = {
  enabled: true,
  clickFreq: 1000,
  clickAmount: 0.1,
  clickDuration: 0.005,
};

// Вспомогательные функции
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function applySoftSaturation(buffer, amount) {
  const newBuffer = new AudioBuffer({
    length: buffer.length,
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
  });

  const threshold = 0.8;
  const knee = 0.1;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = newBuffer.getChannelData(channel);

    for (let i = 0; i < buffer.length; i++) {
      let sample = inputData[i] * (1 + amount * 0.5);

      if (Math.abs(sample) > threshold - knee) {
        const x = Math.abs(sample);
        if (x > threshold + knee) {
          sample =
            Math.sign(sample) *
            (threshold + (x - threshold) / (1 + amount * 2));
        } else {
          const softPart = (x - threshold + knee) / (2 * knee);
          sample = Math.sign(sample) * (threshold - knee + softPart * knee);
        }
      }

      outputData[i] = sample;
    }
  }

  return newBuffer;
}

function checkForClipping(audioData) {
  for (let i = 0; i < audioData.length; i++) {
    if (Math.abs(audioData[i]) > 0.99) {
      return true;
    }
  }
  return false;
}

function showClippingWarning() {
  const warning = document.getElementById("clipping-warning");
  warning.style.display = "block";

  setTimeout(() => {
    warning.style.display = "none";
  }, 5000);
}

function bufferToWave(abuffer) {
  const numOfChan = abuffer.numberOfChannels;
  const length = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  setUint32(0x46464952);
  setUint32(length - 8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(length - pos - 4);

  for (let i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      const sample = Math.max(-1, Math.min(1, channels[i][offset]));
      const val = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(pos, val, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// Основные функции
function generateRandomKick() {
  const duration = durationParams.duration;
  const freqStart = frequencyParams.minFreq;
  const freqEnd = freqStart * frequencyParams.pitchDecay;

  return { duration, freqStart, freqEnd };
}

function generateKickAndDrawStaticOscilloscope() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const { duration, freqStart, freqEnd } = generateRandomKick();

  const releaseTime = adsrParams.release;
  const totalDuration = duration + releaseTime;

  const sampleRate = audioCtx.sampleRate;
  const totalSamples = Math.floor(totalDuration * sampleRate);

  const offlineCtx = new OfflineAudioContext(1, totalSamples, sampleRate);

  // Основной осциллятор для баса
  const bassOscillator = offlineCtx.createOscillator();
  const bassGain = offlineCtx.createGain();

  bassOscillator.connect(bassGain);
  bassGain.connect(offlineCtx.destination);

  const startTime = offlineCtx.currentTime;

  // Настройка основного баса
  bassOscillator.type = "sine";
  bassOscillator.frequency.setValueAtTime(freqStart, startTime);

  bassOscillator.frequency.exponentialRampToValueAtTime(
    Math.max(40, freqEnd),
    startTime + duration * 0.3
  );

  // ADSR с защитой от клиппинга
  const { attack, decay, sustain } = adsrParams;
  const overallVolume = amplitudeParams.volume * 0.8;

  bassGain.gain.setValueAtTime(0, startTime);
  bassGain.gain.linearRampToValueAtTime(overallVolume, startTime + attack);
  bassGain.gain.linearRampToValueAtTime(
    sustain * overallVolume * 0.9,
    startTime + attack + decay
  );
  bassGain.gain.linearRampToValueAtTime(0, startTime + totalDuration);

  bassOscillator.start(startTime);
  bassOscillator.stop(startTime + totalDuration);

  // Высокочастотный щелчек
  if (clickParams.enabled && clickParams.clickAmount > 0) {
    const clickOscillator = offlineCtx.createOscillator();
    const clickGain = offlineCtx.createGain();
    const clickFilter = offlineCtx.createBiquadFilter();

    clickOscillator.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(offlineCtx.destination);

    clickOscillator.type = "square";
    clickOscillator.frequency.setValueAtTime(clickParams.clickFreq, startTime);

    clickFilter.type = "highpass";
    clickFilter.frequency.setValueAtTime(800, startTime);
    clickFilter.Q.setValueAtTime(1.0, startTime);

    const clickVolume = clickParams.clickAmount * overallVolume * 0.5;

    clickGain.gain.setValueAtTime(0, startTime);
    clickGain.gain.linearRampToValueAtTime(clickVolume, startTime + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(
      0.0001,
      startTime + clickParams.clickDuration
    );

    clickOscillator.start(startTime);
    clickOscillator.stop(startTime + clickParams.clickDuration + 0.01);
  }

  offlineCtx
    .startRendering()
    .then((renderedBuffer) => {
      let finalBuffer = renderedBuffer;
      if (amplitudeParams.saturation > 0) {
        finalBuffer = applySoftSaturation(
          renderedBuffer,
          amplitudeParams.saturation
        );
      }

      const audioData = finalBuffer.getChannelData(0);
      const isClipping = checkForClipping(audioData);

      if (isClipping) {
        showClippingWarning();
      }

      drawStaticOscilloscope(
        audioData,
        totalDuration,
        freqStart,
        freqEnd,
        isClipping
      );
      createAudioControls(finalBuffer);
    })
    .catch((error) => {
      console.error("Rendering error:", error);
    });
}

function drawStaticOscilloscope(
  audioData,
  duration,
  freqStart,
  freqEnd,
  mode,
  isClipping
) {
  const oldCanvas = document.getElementById("oscilloscope");
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement("canvas");
  canvas.id = "oscilloscope";
  canvas.width = 800;
  canvas.height = 300;
  canvas.style.display = "block";
  canvas.style.background = "#000";
  canvas.style.border = "2px solid #333";
  canvas.style.borderRadius = "8px";
  canvas.style.margin = "20px auto";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // Рисуем сетку
  function drawGrid() {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += canvas.width / 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += canvas.height / 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#444";
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }

  // Рисуем волну
  function drawWaveform() {
    ctx.strokeStyle = "#0f0";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const step = Math.ceil(audioData.length / canvas.width);
    const centerY = canvas.height / 2;
    const amplitude = canvas.height * 0.4;

    for (let x = 0; x < canvas.width; x++) {
      const sampleIndex = Math.floor(x * (audioData.length / canvas.width));
      const sample = audioData[Math.min(sampleIndex, audioData.length - 1)];
      const y = centerY - sample * amplitude;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  drawGrid();
  drawWaveform();

  // Подписи с параметрами
  ctx.fillStyle = mode === "eight08" ? "#ff0" : "#0f0";
  ctx.font = "14px monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    `Freq: ${freqStart.toFixed(0)}Hz → ${freqEnd.toFixed(
      0
    )}Hz | Dur: ${duration.toFixed(2)}s`,
    canvas.width / 2,
    20
  );
  ctx.fillText(
    `Pitch: ${frequencyParams.pitchDecay.toFixed(
      2
    )} | Click: ${clickParams.clickAmount.toFixed(1)}`,
    canvas.width / 2,
    40
  );
  ctx.fillText(
    `Click Freq: ${
      clickParams.clickFreq
    }Hz | Vol: ${amplitudeParams.volume.toFixed(1)}`,
    canvas.width / 2,
    60
  );

  // Индикация клиппинга
  if (isClipping) {
    ctx.fillStyle = "#f00";
    ctx.font = "bold 16px monospace";
    ctx.fillText("CLIPPING!", canvas.width / 2, 100);
    ctx.strokeStyle = "#f00";
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  }
}

function createAudioControls(audioBuffer) {
  const oldControls = document.getElementById("audio-controls");
  if (oldControls) oldControls.remove();

  const controlsDiv = document.createElement("div");
  controlsDiv.id = "audio-controls";
  controlsDiv.style.display = "flex";
  controlsDiv.style.justifyContent = "center";
  controlsDiv.style.gap = "20px";
  controlsDiv.style.margin = "20px 0";
  document.body.appendChild(controlsDiv);

  // Кнопка Play
  const playBtn = document.createElement("button");
  playBtn.textContent = "Play";
  playBtn.style.background = "#333";
  playBtn.style.color = "#fff";
  playBtn.style.border = `1px solid #fff`;
  playBtn.addEventListener("mouseover", () => {
    playBtn.style.color = "#0f0";
    playBtn.style.borderColor = "#0f0";
  });

  playBtn.addEventListener("mouseout", () => {
    playBtn.style.color = "#fff";
    playBtn.style.borderColor = "#fff";
  });
  playBtn.addEventListener("click", () => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();
  });

  // Кнопка Download
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download WAV";
  downloadBtn.style.background = "#333";
  downloadBtn.style.color = "#fff";
  downloadBtn.style.border = `1px solid #fff`;
  downloadBtn.addEventListener("mouseover", () => {
    downloadBtn.style.color = "#0f0";
    downloadBtn.style.borderColor = "#0f0";
  });
  downloadBtn.addEventListener("mouseout", () => {
    downloadBtn.style.color = "#fff";
    downloadBtn.style.borderColor = "#fff";
  });
  downloadBtn.addEventListener("click", () => {
    const wavBlob = bufferToWave(audioBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentMode === "eight08" ? "808-kick.wav" : "kick.wav";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });

  controlsDiv.appendChild(playBtn);
  controlsDiv.appendChild(downloadBtn);
}

function createSliderPanel(
  panelId,
  title,
  paramsConfig,
  paramsObject,
  onChange
) {
  const panel = document.getElementById(panelId);
  panel.innerHTML = `<h3>${title}</h3>`;

  paramsConfig.forEach((config, index) => {
    const container = document.createElement("div");
    container.className = "slider-container";

    const label = document.createElement("label");
    label.textContent = config.label + ":";
    label.htmlFor = config.name;

    const input = document.createElement("input");
    input.type = "range";
    input.id = config.name;
    input.name = config.name;
    input.min = config.min;
    input.max = config.max;
    input.step = config.step;
    input.value = paramsObject[config.name];
    input.disabled = config.disabled || false;

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "value-display";
    valueDisplay.textContent = config.unit
      ? `${paramsObject[config.name]}${config.unit}`
      : paramsObject[config.name].toFixed(config.precision || 2);

    input.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      paramsObject[config.name] = value;

      if (config.unit) {
        valueDisplay.textContent = `${value}${config.unit}`;
      } else {
        valueDisplay.textContent = value.toFixed(config.precision || 2);
      }

      if (onChange) onChange(config.name, value);
    });

    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(valueDisplay);
    panel.appendChild(container);
  });
}

function initializeControls() {
  // Frequency controls
  createSliderPanel(
    "frequency-panel",
    "Frequency Settings",
    [
      {
        name: "minFreq",
        label: "Frequancy",
        min: 20,
        max: 200,
        step: 1,
        value: 100,
        unit: "Hz",
      },
      {
        name: "pitchDecay",
        label: "Pitch Decay",
        min: 0.05,
        max: 1,
        step: 0.05,
        value: 0.1,
        precision: 2,
      },
    ],
    frequencyParams
  );

  // Amplitude controls
  createSliderPanel(
    "amplitude-panel",
    "Amplitude Settings",
    [
      {
        name: "volume",
        label: "Volume",
        min: 0.1,
        max: 0.8,
        step: 0.1,
        value: 0.7,
        precision: 1,
      },
      {
        name: "saturation",
        label: "Saturation",
        min: 0.0,
        max: 1,
        step: 0.1,
        value: 0.0,
        precision: 1,
      },
    ],
    amplitudeParams
  );

  // Duration controls
  createSliderPanel(
    "duration-panel",
    "Duration Settings",
    [
      {
        name: "duration",
        label: "Duration",
        min: 0.1,
        max: 3.0,
        step: 0.1,
        value: 0.5,
        unit: "s",
        precision: 1,
      },
    ],
    durationParams
  );

  // ADSR controls
  createSliderPanel(
    "adsr-panel",
    "ADSR Envelope",
    [
      {
        name: "attack",
        label: "Attack",
        min: 0.001,
        max: 0.05,
        step: 0.001,
        value: 0.005,
        unit: "s",
        precision: 3,
      },
      {
        name: "decay",
        label: "Decay",
        min: 0.01,
        max: 0.5,
        step: 0.01,
        value: 0.1,
        unit: "s",
        precision: 2,
      },
      {
        name: "sustain",
        label: "Sustain",
        min: 0.0,
        max: 0.8,
        step: 0.1,
        value: 0.3,
        precision: 1,
      },
      {
        name: "release",
        label: "Release",
        min: 0.01,
        max: 1.0,
        step: 0.01,
        value: 0.3,
        unit: "s",
        precision: 2,
      },
    ],
    adsrParams
  );

  createSliderPanel(
    "click-panel",
    "Click Settings",
    [
      {
        name: "clickAmount",
        label: "Click Amount",
        min: 0.0,
        max: 1.0,
        step: 0.1,
        value: 0.3,
        precision: 1,
      },
      {
        name: "clickFreq",
        label: "Click Frequency",
        min: 500,
        max: 5000,
        step: 100,
        value: 2000,
        unit: "Hz",
      },
      {
        name: "clickDuration",
        label: "Click Duration",
        min: 0.005,
        max: 0.1,
        step: 0.005,
        value: 0.02,
        unit: "s",
        precision: 3,
      },
    ],
    clickParams
  );

  // Generate button
  document
    .getElementById("generate-btn")
    .addEventListener("click", generateKickAndDrawStaticOscilloscope);
}

// Инициализация
window.addEventListener("DOMContentLoaded", initializeControls);
