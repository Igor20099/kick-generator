
function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

function generateKickAndDrawStaticOscilloscope() {
    // Создаем аудиоконтекст
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const duration = Math.random(0.2,1.1);
    const sampleRate = audioCtx.sampleRate;
    const totalSamples = Math.floor(duration * sampleRate);
    
    // Создаем буфер для offline рендеринга
    const offlineCtx = new OfflineAudioContext(1, totalSamples, sampleRate);
    
    // Создаем осциллятор и усилитель
    const oscillator = offlineCtx.createOscillator();
    const gainNode = offlineCtx.createGain();

    const freqStart = randomInRange(40,200)
    const freqEnd = freqStart * 0.3
    
    // Подключаем узлы
    oscillator.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    
    // Настраиваем параметры
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freqStart, offlineCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(freqEnd, offlineCtx.currentTime + duration);
    
    gainNode.gain.setValueAtTime(1, offlineCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, offlineCtx.currentTime + duration );
    
    // Запускаем осциллятор
    oscillator.start();
    oscillator.stop(offlineCtx.currentTime + duration);
    
    // Рендерим аудио в буфер
    offlineCtx.startRendering().then(renderedBuffer => {
        const audioData = renderedBuffer.getChannelData(0);
        const source = audioCtx.createBufferSource();
    source.buffer = renderedBuffer;
    source.connect(audioCtx.destination);
    source.start();
        drawStaticOscilloscope(audioData, duration);
        createAudioControls(renderedBuffer);
    });
  }
  
  function drawStaticOscilloscope(audioData, duration) {
    // Удаляем старый canvas если есть
    const oldCanvas = document.getElementById('oscilloscope');
    if (oldCanvas) oldCanvas.remove();
    
    // Создаем canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'oscilloscope';
    canvas.width = 800;
    canvas.height = 400;
    canvas.style.display = 'block';
    canvas.style.background = '#000';
    canvas.style.border = '2px solid #333';
    canvas.style.borderRadius = '8px';
    canvas.style.margin = '20px auto';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // Рисуем сетку осциллографа
    function drawGrid() {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      
      // Вертикальные линии (временные деления)
      for (let x = 0; x < canvas.width; x += canvas.width / 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Горизонтальные линии (амплитудные деления)
      for (let y = 0; y < canvas.height; y += canvas.height / 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Центральная ось
      ctx.strokeStyle = '#444';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
    
    // Рисуем волну
    function drawWaveform() {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const step = Math.ceil(audioData.length / canvas.width);
      const centerY = canvas.height / 2;
      const amplitude = canvas.height * 0.4;
      
      for (let x = 0; x < canvas.width; x++) {
        const sampleIndex = Math.floor(x * (audioData.length / canvas.width));
        const sample = audioData[Math.min(sampleIndex, audioData.length - 1)];
        const y = centerY - (sample * amplitude);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Отрисовываем все элементы
    drawGrid();
    drawWaveform();
    
    // Добавляем подписи
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center'
    ctx.fillText(`Duration: ${duration.toFixed(2)}s`, canvas.width / 2, 40);
    
  }
  
  // Создаем кнопку
  const btn = document.querySelector('.generate_btn');
  btn.textContent = 'Generate Kick';
  btn.style.padding = '12px 24px';
  btn.style.margin = '20px auto';
  btn.style.display = 'block';
  btn.style.background = '#333';
  btn.style.color = '#fff';
  btn.style.border = '1px solid #fff';
  btn.style.borderRadius = '4px';
  btn.style.fontFamily = 'monospace';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '16px';
  btn.addEventListener('click', generateKickAndDrawStaticOscilloscope);
  document.body.appendChild(btn);

  function createAudioControls(audioBuffer) {
    // Удаляем старые кнопки если есть
    const oldControls = document.getElementById('audio-controls');
    if (oldControls) oldControls.remove();
    
    // Создаем контейнер для кнопок
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'audio-controls';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.justifyContent = 'center';
    controlsDiv.style.gap = '20px';
    controlsDiv.style.margin = '20px 0';
    document.body.appendChild(controlsDiv);
    
    // Кнопка Play
    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.style.padding = '10px 20px';
    playBtn.style.background = '#333';
    playBtn.style.color = '#fff';
    playBtn.style.border = '1px solid #fff';
    playBtn.style.borderRadius = '4px';
    playBtn.style.cursor = 'pointer';
    playBtn.style.fontFamily = 'monospace';
    
    playBtn.addEventListener('click', () => {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
    });
    
    // Кнопка Download
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download WAV';
    downloadBtn.style.padding = '10px 20px';
    downloadBtn.style.background = '#333';
    downloadBtn.style.color = '#fff';
    downloadBtn.style.border = '1px solid #fff';
    downloadBtn.style.borderRadius = '4px';
    downloadBtn.style.cursor = 'pointer';
    downloadBtn.style.fontFamily = 'monospace';
    
    downloadBtn.addEventListener('click', () => {
      const wavBlob = bufferToWave(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kick-drum.wav';
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
  
  // Функция для конвертации AudioBuffer в WAV
  function bufferToWave(abuffer) {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;
    
    // Записываем WAV-заголовок
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // Длина файла
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // Длина блока формата
    setUint16(1); // PCM формат
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // Байтрейт
    setUint16(numOfChan * 2); // Выравнивание блока
    setUint16(16); // Битрейт
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4); // Длина данных
    
    // Записываем данные каналов
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
    
    return new Blob([buffer], { type: 'audio/wav' });
    
    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }
    
    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }
  