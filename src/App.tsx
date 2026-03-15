import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Volume2, VolumeX, Vibrate, VibrateOff, Info, Moon, Heart, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<'constant' | 'progressive'>('progressive');
  const [pulseType, setPulseType] = useState<'single' | 'heartbeat'>('single');
  const [startBpm, setStartBpm] = useState(60);
  const [minBpm, setMinBpm] = useState(40);
  const [intensity, setIntensity] = useState(50); // 1-100
  const [durationMins, setDurationMins] = useState(15); // 1-60
  
  const [currentBpm, setCurrentBpm] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60);
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const settingsRef = useRef({
    mode, pulseType, startBpm, minBpm, durationMins, intensity, vibrationEnabled, soundEnabled
  });

  // Update refs so the interval doesn't need to restart on setting change
  useEffect(() => {
    settingsRef.current = { mode, pulseType, startBpm, minBpm, durationMins, intensity, vibrationEnabled, soundEnabled };
  }, [mode, pulseType, startBpm, minBpm, durationMins, intensity, vibrationEnabled, soundEnabled]);

  // Reset current BPM and time when not playing and settings change
  useEffect(() => {
    if (!isPlaying) {
      setCurrentBpm(startBpm);
      setTimeRemaining(durationMins * 60);
    }
  }, [startBpm, durationMins, isPlaying]);

  // Wake Lock
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isPlaying) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          // Ignore NotAllowedError as it's expected in some iframe environments
          if (err.name !== 'NotAllowedError') {
            console.error(`WakeLock error: ${err.name}, ${err.message}`);
          }
        }
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isPlaying]);

  // Main Loop
  useEffect(() => {
    if (!isPlaying) {
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend();
      }
      return;
    }

    // Initialize AudioContext
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    // Silent audio loop to keep background execution alive on mobile
    let silentSource: AudioBufferSourceNode | null = null;
    if (audioCtxRef.current) {
      const silentBuffer = audioCtxRef.current.createBuffer(1, audioCtxRef.current.sampleRate * 2, audioCtxRef.current.sampleRate);
      silentSource = audioCtxRef.current.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.loop = true;
      silentSource.connect(audioCtxRef.current.destination);
      silentSource.start();
    }

    let timeoutId: number;
    const startTime = Date.now();
    let expectedTime = startTime;

    const tick = () => {
      const now = Date.now();
      const elapsedTotal = now - startTime;
      const { mode, pulseType, startBpm, minBpm, durationMins, intensity, vibrationEnabled, soundEnabled } = settingsRef.current;
      const durationMs = durationMins * 60 * 1000;
      
      if (elapsedTotal >= durationMs) {
        setIsPlaying(false);
        return;
      }

      // Calculate current BPM
      let bpm = startBpm;
      if (mode === 'progressive') {
        const progress = Math.min(1, elapsedTotal / durationMs);
        bpm = startBpm - (startBpm - minBpm) * progress;
      }
      
      setCurrentBpm(Math.round(bpm));
      setTimeRemaining(Math.max(0, Math.ceil((durationMs - elapsedTotal) / 1000)));

      // Play pulse (Vibration)
      if (vibrationEnabled && 'vibrate' in navigator) {
        // Map intensity 1-100 to duration 10ms-150ms
        const duration = 10 + (intensity / 100) * 140;
        if (pulseType === 'heartbeat') {
          // Double pulse for heartbeat
          navigator.vibrate([duration, 150, duration * 0.8]);
        } else {
          // Single pulse
          navigator.vibrate(duration);
        }
      }
      
      // Play pulse (Sound)
      if (soundEnabled && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const maxGain = (intensity / 100) * 2.5; // Compensate for lowpass filter
        
        const playTone = (timeOffset: number, duration: number, startFreq: number, endFreq: number, gainMult: number = 1) => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          
          // Triangle wave with a lowpass filter creates a muffled, organic "thud"
          osc.type = 'triangle';
          
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(150, ctx.currentTime + timeOffset);
          filter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + timeOffset + duration);
          
          osc.frequency.setValueAtTime(startFreq, ctx.currentTime + timeOffset);
          osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + timeOffset + duration);
          
          // Smooth attack and decay to prevent the "pop" or "click" sound
          gain.gain.setValueAtTime(0, ctx.currentTime + timeOffset);
          gain.gain.linearRampToValueAtTime(maxGain * gainMult, ctx.currentTime + timeOffset + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + duration);
          
          osc.start(ctx.currentTime + timeOffset);
          osc.stop(ctx.currentTime + timeOffset + duration);
        };

        if (pulseType === 'heartbeat') {
          // "Lub... dub"
          playTone(0, 0.3, 45, 20, 1); // First beat (lub)
          playTone(0.25, 0.25, 50, 25, 0.7); // Second beat (dub)
        } else {
          // Single "Tun"
          playTone(0, 0.3, 45, 20, 1);
        }
      }
      
      setPulseTrigger(prev => prev + 1);
      
      if (pulseType === 'heartbeat') {
        // Trigger visualizer again for the second beat
        setTimeout(() => {
          if (isPlaying) setPulseTrigger(prev => prev + 1);
        }, 250);
      }

      const intervalMs = 60000 / bpm;
      expectedTime += intervalMs;
      const delay = Math.max(0, expectedTime - Date.now());

      timeoutId = window.setTimeout(tick, delay);
    };

    // Start first tick
    tick();

    return () => {
      window.clearTimeout(timeoutId);
      if (silentSource) {
        silentSource.stop();
      }
    };
  }, [isPlaying]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="max-w-md mx-auto p-6 pb-32">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 pt-4">
          <div className="flex items-center gap-2">
            <Moon className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Ritmo de Sueño</h1>
          </div>
          <button 
            onClick={() => setShowInfo(true)}
            className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          >
            <Info className="w-5 h-5" />
          </button>
        </header>

        {/* Visualizer */}
        <div className="relative w-64 h-64 flex items-center justify-center mx-auto my-12">
          <AnimatePresence>
            {pulseTrigger > 0 && (
              <motion.div
                key={pulseTrigger}
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: pulseType === 'heartbeat' ? 0.8 : 1.2, ease: "easeOut" }}
                className="absolute inset-0 rounded-full bg-indigo-500/40 pointer-events-none"
              />
            )}
          </AnimatePresence>
          
          <motion.div 
            key={`main-${pulseTrigger}`}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative z-10 w-48 h-48 rounded-full bg-slate-900 border-4 border-indigo-500/30 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.15)]"
          >
            <span className="text-5xl font-bold text-white tracking-tighter">{currentBpm}</span>
            <span className="text-xs text-indigo-400 font-bold tracking-widest uppercase mt-1">BPM</span>
            
            <div className="absolute bottom-6 text-sm text-slate-400 font-mono font-medium">
              {formatTime(timeRemaining)}
            </div>
          </motion.div>
        </div>

        {/* Controls */}
        <div className="space-y-8 bg-slate-900/50 p-6 rounded-3xl border border-slate-800/50">
          
          {/* Mode Toggle */}
          <div className="flex p-1 bg-slate-950 rounded-xl">
            <button
              onClick={() => setMode('constant')}
              disabled={isPlaying}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'constant' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-50'
              }`}
            >
              Constante
            </button>
            <button
              onClick={() => setMode('progressive')}
              disabled={isPlaying}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'progressive' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-50'
              }`}
            >
              Progresivo
            </button>
          </div>

          {/* Pulse Type Toggle */}
          <div className="flex p-1 bg-slate-950 rounded-xl">
            <button
              onClick={() => setPulseType('single')}
              disabled={isPlaying}
              className={`flex-1 py-2 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-all ${
                pulseType === 'single' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-50'
              }`}
            >
              <Activity className="w-4 h-4" />
              Pulso Simple
            </button>
            <button
              onClick={() => setPulseType('heartbeat')}
              disabled={isPlaying}
              className={`flex-1 py-2 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-all ${
                pulseType === 'heartbeat' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-50'
              }`}
            >
              <Heart className="w-4 h-4" />
              Latido (Doble)
            </button>
          </div>

          <div className="space-y-6">
            {/* Start BPM */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-400">
                  {mode === 'progressive' ? 'BPM Inicial' : 'Frecuencia (BPM)'}
                </label>
                <span className="text-sm font-bold text-slate-200">{startBpm}</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                value={startBpm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setStartBpm(val);
                  if (val < minBpm) setMinBpm(val);
                }}
                disabled={isPlaying}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* Min BPM (Only Progressive) */}
            {mode === 'progressive' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-400">BPM Mínimo (Final)</label>
                  <span className="text-sm font-bold text-slate-200">{minBpm}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max={startBpm}
                  value={minBpm}
                  onChange={(e) => setMinBpm(Number(e.target.value))}
                  disabled={isPlaying}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                />
              </motion.div>
            )}

            {/* Intensity */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-400">Intensidad</label>
                <span className="text-sm font-bold text-slate-200">{intensity}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Duration */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-400">Duración</label>
                <span className="text-sm font-bold text-slate-200">{durationMins} min</span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                disabled={isPlaying}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Output Toggles */}
          <div className="flex gap-4 pt-2">
            <button
              onClick={() => setVibrationEnabled(!vibrationEnabled)}
              className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                vibrationEnabled 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {vibrationEnabled ? <Vibrate className="w-6 h-6 mb-2" /> : <VibrateOff className="w-6 h-6 mb-2" />}
              <span className="text-xs font-bold uppercase tracking-wider">Vibración</span>
            </button>
            
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                soundEnabled 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-6 h-6 mb-2" /> : <VolumeX className="w-6 h-6 mb-2" />}
              <span className="text-xs font-bold uppercase tracking-wider">Sonido</span>
            </button>
          </div>

        </div>

        {/* Play Button */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
          <button
            onClick={togglePlay}
            className={`w-full max-w-md mx-auto flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${
              isPlaying 
                ? 'bg-slate-800 text-white hover:bg-slate-700' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/25'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-6 h-6 fill-current" />
                Detener
              </>
            ) : (
              <>
                <Play className="w-6 h-6 fill-current" />
                Iniciar Relajación
              </>
            )}
          </button>
        </div>

      </div>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 p-6 rounded-3xl max-w-sm w-full border border-slate-800 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-500/20 rounded-full text-indigo-400">
                  <Info className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Acerca de la Vibración</h3>
              </div>
              
              <div className="text-slate-300 text-sm space-y-4 mb-8">
                <p>
                  La vibración (haptics) en navegadores web tiene algunas limitaciones dependiendo de tu dispositivo:
                </p>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                  <h4 className="font-bold text-white mb-1">🍎 iOS (iPhone/iPad)</h4>
                  <p className="text-slate-400">Apple no permite vibración desde el navegador web. Te recomendamos usar la opción de <strong>Sonido</strong> (latido) para guiar tu respiración.</p>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                  <h4 className="font-bold text-white mb-1">🤖 Android</h4>
                  <p className="text-slate-400">La vibración funciona bien, pero algunos teléfonos pueden pausarla si bloqueas la pantalla. Mantener el sonido activado ayuda a que la app siga funcionando en segundo plano.</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowInfo(false)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
