import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Volume2, VolumeX, Vibrate, VibrateOff, Info, Moon, Heart, Activity, Waves, Wind, Bird, Leaf, CloudRain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const createNoiseBuffer = (ctx: AudioContext, type: 'white' | 'pink') => {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  } else {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }
  }
  return buffer;
};

const startAmbientSounds = (ctx: AudioContext) => {
  const nodes: any = {};
  const sources: AudioBufferSourceNode[] = [];
  const oscillators: OscillatorNode[] = [];

  const whiteNoise = createNoiseBuffer(ctx, 'white');
  const pinkNoise = createNoiseBuffer(ctx, 'pink');

  const createNoiseSource = (buffer: AudioBuffer) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    sources.push(src);
    return src;
  };

  // Master Limiter to prevent ANY clipping
  nodes.master = ctx.createDynamicsCompressor();
  nodes.master.threshold.value = -1;
  nodes.master.knee.value = 2;
  nodes.master.ratio.value = 20;
  nodes.master.attack.value = 0.002;
  nodes.master.release.value = 0.1;
  nodes.master.connect(ctx.destination);

  // 1. Sea
  const seaSrc = createNoiseSource(pinkNoise);
  const seaFilter = ctx.createBiquadFilter();
  seaFilter.type = 'lowpass';
  const seaLfo = ctx.createOscillator();
  seaLfo.frequency.value = 0.1;
  const seaLfoGain = ctx.createGain();
  seaLfoGain.gain.value = 400;
  seaFilter.frequency.value = 400;
  seaLfo.connect(seaLfoGain).connect(seaFilter.frequency);
  seaLfo.start();
  oscillators.push(seaLfo);
  nodes.seaGain = ctx.createGain();
  nodes.seaGain.gain.value = 0;
  seaSrc.connect(seaFilter).connect(nodes.seaGain).connect(nodes.master);

  // 2. Wind
  const windSrc = createNoiseSource(pinkNoise);
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.Q.value = 1.5;
  const windLfo = ctx.createOscillator();
  windLfo.frequency.value = 0.15;
  const windLfoGain = ctx.createGain();
  windLfoGain.gain.value = 300;
  windFilter.frequency.value = 500;
  windLfo.connect(windLfoGain).connect(windFilter.frequency);
  windLfo.start();
  oscillators.push(windLfo);
  nodes.windGain = ctx.createGain();
  nodes.windGain.gain.value = 0;
  windSrc.connect(windFilter).connect(nodes.windGain).connect(nodes.master);

  // 3. Forest (Birds)
  nodes.forestGain = ctx.createGain();
  nodes.forestGain.gain.value = 0;
  nodes.forestGain.connect(nodes.master);

  let isBirdPlaying = true;
  let birdTimeout: number;

  const playBirdChirp = () => {
    if (!isBirdPlaying) return;
    
    const now = ctx.currentTime;
    const numChirps = Math.floor(Math.random() * 4) + 1; // 1 to 4 chirps
    
    // Randomize bird characteristics for this cluster
    const baseFreq = 2500 + Math.random() * 3000; // 2.5kHz - 5.5kHz
    const sweepDir = Math.random() > 0.4 ? 1 : -1; // Slightly more upward sweeps
    const sweepAmount = 400 + Math.random() * 1500;
    const duration = 0.08 + Math.random() * 0.1; // 80ms to 180ms
    
    for (let i = 0; i < numChirps; i++) {
      const timeOffset = now + i * (duration + 0.05) + Math.random() * 0.05;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(nodes.forestGain);
      
      osc.type = 'sine';
      
      // Frequency sweep
      osc.frequency.setValueAtTime(baseFreq, timeOffset);
      osc.frequency.exponentialRampToValueAtTime(Math.max(100, baseFreq + (sweepAmount * sweepDir)), timeOffset + duration);
      
      // Amplitude envelope
      gain.gain.setValueAtTime(0, timeOffset);
      gain.gain.linearRampToValueAtTime(0.4, timeOffset + duration * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + duration);
      
      osc.start(timeOffset);
      osc.stop(timeOffset + duration);
    }
    
    // Schedule next bird sound (1.5 to 5 seconds)
    birdTimeout = window.setTimeout(playBirdChirp, 1500 + Math.random() * 3500);
  };
  
  playBirdChirp();

  // 4. Leaves
  const leavesSrc = createNoiseSource(whiteNoise);
  const leavesFilter = ctx.createBiquadFilter();
  leavesFilter.type = 'bandpass';
  leavesFilter.frequency.value = 3000;
  leavesFilter.Q.value = 0.5;
  const leavesLfo = ctx.createOscillator();
  leavesLfo.frequency.value = 0.5;
  const leavesLfoGain = ctx.createGain();
  leavesLfoGain.gain.value = 1500;
  leavesLfo.connect(leavesLfoGain).connect(leavesFilter.frequency);
  leavesLfo.start();
  oscillators.push(leavesLfo);
  nodes.leavesGain = ctx.createGain();
  nodes.leavesGain.gain.value = 0;
  leavesSrc.connect(leavesFilter).connect(nodes.leavesGain).connect(nodes.master);

  // 5. Rain
  const rainSrc = createNoiseSource(pinkNoise);
  const rainFilter = ctx.createBiquadFilter();
  rainFilter.type = 'lowpass';
  rainFilter.frequency.value = 1000;
  nodes.rainGain = ctx.createGain();
  nodes.rainGain.gain.value = 0;
  rainSrc.connect(rainFilter).connect(nodes.rainGain).connect(nodes.master);

  nodes.stopAll = () => {
    isBirdPlaying = false;
    window.clearTimeout(birdTimeout);
    sources.forEach(s => { s.stop(); s.disconnect(); });
    oscillators.forEach(o => { o.stop(); o.disconnect(); });
  };

  return nodes;
};

const AmbientSlider = ({ icon, label, value, onChange }: any) => (
  <div className="flex items-center gap-4">
    <div className={`p-2 rounded-full ${value > 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
    </div>
    <div className="flex-1">
      <div className="flex justify-between mb-1">
        <label className="text-xs font-medium text-slate-400">{label}</label>
        <span className="text-xs font-bold text-slate-300">{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  </div>
);

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<'constant' | 'progressive'>('progressive');
  const [pulseType, setPulseType] = useState<'single' | 'heartbeat'>('single');
  const [startBpm, setStartBpm] = useState(60);
  const [minBpm, setMinBpm] = useState(40);
  const [intensity, setIntensity] = useState(25); // 1-100
  const [durationMins, setDurationMins] = useState(15); // 1-60
  
  const [currentBpm, setCurrentBpm] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60);
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  
  const [singleSound, setSingleSound] = useState('soft');
  const [heartbeatSound, setHeartbeatSound] = useState('organic');
  
  const [volSea, setVolSea] = useState(0);
  const [volWind, setVolWind] = useState(0);
  const [volForest, setVolForest] = useState(0);
  const [volLeaves, setVolLeaves] = useState(0);
  const [volRain, setVolRain] = useState(0);
  
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientNodesRef = useRef<any>({});
  const settingsRef = useRef({
    mode, pulseType, startBpm, minBpm, durationMins, intensity, vibrationEnabled, soundEnabled, singleSound, heartbeatSound
  });

  // Update refs so the interval doesn't need to restart on setting change
  useEffect(() => {
    settingsRef.current = { mode, pulseType, startBpm, minBpm, durationMins, intensity, vibrationEnabled, soundEnabled, singleSound, heartbeatSound };
  }, [mode, pulseType, startBpm, minBpm, durationMins, intensity, vibrationEnabled, soundEnabled, singleSound, heartbeatSound]);

  // Reset current BPM and time when not playing and settings change
  useEffect(() => {
    if (!isPlaying) {
      setCurrentBpm(startBpm);
      setTimeRemaining(durationMins * 60);
    }
  }, [startBpm, durationMins, isPlaying]);

  // Update ambient volumes
  useEffect(() => {
    if (ambientNodesRef.current && audioCtxRef.current) {
      const nodes = ambientNodesRef.current;
      const t = 0.1; // smoothing
      const now = audioCtxRef.current.currentTime;
      if (nodes.seaGain) nodes.seaGain.gain.setTargetAtTime(volSea / 100, now, t);
      if (nodes.windGain) nodes.windGain.gain.setTargetAtTime(volWind / 100, now, t);
      if (nodes.forestGain) nodes.forestGain.gain.setTargetAtTime((volForest / 100) * 0.6, now, t);
      if (nodes.leavesGain) nodes.leavesGain.gain.setTargetAtTime((volLeaves / 100) * 0.3, now, t);
      if (nodes.rainGain) nodes.rainGain.gain.setTargetAtTime((volRain / 100) * 1.5, now, t);
    }
  }, [volSea, volWind, volForest, volLeaves, volRain]);

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

    // Initialize ambient sounds
    if (audioCtxRef.current && !ambientNodesRef.current.stopAll) {
      ambientNodesRef.current = startAmbientSounds(audioCtxRef.current);
      const nodes = ambientNodesRef.current;
      const now = audioCtxRef.current.currentTime;
      nodes.seaGain.gain.setValueAtTime(volSea / 100, now);
      nodes.windGain.gain.setValueAtTime(volWind / 100, now);
      nodes.forestGain.gain.setValueAtTime((volForest / 100) * 0.6, now);
      nodes.leavesGain.gain.setValueAtTime((volLeaves / 100) * 0.3, now);
      nodes.rainGain.gain.setValueAtTime((volRain / 100) * 1.5, now);
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
        // High gain for volume, but routed through a compressor to prevent clipping/static
        const maxGain = (intensity / 100) * 2.5; 
        
        const playSound = (timeOffset: number, isHeartbeat: boolean, type: 'lub' | 'dub' = 'lub') => {
          const subOsc = ctx.createOscillator();
          const fleshOsc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          const compressor = ctx.createDynamicsCompressor();
          
          // Limiter settings: prevents signal from exceeding 0dB (no clipping)
          compressor.threshold.value = -5;
          compressor.knee.value = 5;
          compressor.ratio.value = 20;
          compressor.attack.value = 0.002;
          compressor.release.value = 0.1;
          
          // Mix the deep sub and the textured "flesh" sound
          subOsc.connect(gain);
          fleshOsc.connect(filter);
          filter.connect(gain);
          gain.connect(compressor);
          
          // Connect to master limiter if it exists, otherwise destination
          const masterNode = ambientNodesRef.current?.master || ctx.destination;
          compressor.connect(masterNode);
          
          const now = ctx.currentTime + timeOffset;
          let duration = 0.3;
          let attack = 0.02;
          let volMult = 1.0;

          if (isHeartbeat) {
            const isDub = type === 'dub';
            const { heartbeatSound } = settingsRef.current;
            
            if (heartbeatSound === 'organic') {
              subOsc.type = 'sine';
              fleshOsc.type = 'square';
              duration = isDub ? 0.25 : 0.4;
              attack = isDub ? 0.02 : 0.06;
              const startFreq = isDub ? 100 : 70;
              const endFreq = isDub ? 40 : 35;
              
              filter.type = 'lowpass';
              filter.Q.value = 0.1; 
              filter.frequency.setValueAtTime(isDub ? 200 : 120, now);
              filter.frequency.exponentialRampToValueAtTime(40, now + duration * 0.3);
              
              subOsc.frequency.setValueAtTime(startFreq, now);
              subOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.4);
              fleshOsc.frequency.setValueAtTime(startFreq, now);
              fleshOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.4);
              volMult = isDub ? 0.6 : 1.0;
            } 
            else if (heartbeatSound === 'deep') {
              subOsc.type = 'sine';
              fleshOsc.type = 'sine';
              duration = isDub ? 0.3 : 0.4;
              attack = isDub ? 0.03 : 0.08;
              const startFreq = isDub ? 80 : 60;
              const endFreq = isDub ? 35 : 30;
              
              filter.type = 'lowpass';
              filter.frequency.setValueAtTime(100, now);
              
              subOsc.frequency.setValueAtTime(startFreq, now);
              subOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.5);
              fleshOsc.frequency.setValueAtTime(0, now);
              volMult = isDub ? 0.7 : 1.0;
            }
            else if (heartbeatSound === 'muffled') {
              subOsc.type = 'sine';
              fleshOsc.type = 'triangle';
              duration = isDub ? 0.25 : 0.4;
              attack = isDub ? 0.04 : 0.1;
              const startFreq = isDub ? 80 : 50;
              const endFreq = isDub ? 30 : 25;
              
              filter.type = 'lowpass';
              filter.frequency.setValueAtTime(isDub ? 100 : 80, now);
              filter.frequency.exponentialRampToValueAtTime(30, now + duration * 0.5);
              
              subOsc.frequency.setValueAtTime(startFreq, now);
              subOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.5);
              fleshOsc.frequency.setValueAtTime(startFreq, now);
              fleshOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.5);
              volMult = isDub ? 0.5 : 0.8;
            }
            else if (heartbeatSound === 'strong') {
              subOsc.type = 'sine';
              fleshOsc.type = 'square';
              duration = isDub ? 0.2 : 0.35;
              attack = isDub ? 0.01 : 0.03;
              const startFreq = isDub ? 120 : 90;
              const endFreq = isDub ? 45 : 40;
              
              filter.type = 'lowpass';
              filter.frequency.setValueAtTime(isDub ? 400 : 300, now);
              filter.frequency.exponentialRampToValueAtTime(50, now + duration * 0.3);
              
              subOsc.frequency.setValueAtTime(startFreq, now);
              subOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.4);
              fleshOsc.frequency.setValueAtTime(startFreq, now);
              fleshOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.4);
              volMult = isDub ? 0.8 : 1.2;
            }
            else if (heartbeatSound === 'electronic') {
              subOsc.type = 'sine';
              fleshOsc.type = 'sine';
              duration = isDub ? 0.3 : 0.5;
              attack = 0.005;
              const startFreq = isDub ? 200 : 150;
              const endFreq = 40;
              
              filter.type = 'lowpass';
              filter.frequency.setValueAtTime(1000, now);
              
              subOsc.frequency.setValueAtTime(startFreq, now);
              subOsc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);
              fleshOsc.frequency.setValueAtTime(0, now);
              volMult = isDub ? 0.6 : 1.0;
            }
          } else {
            // Single pulse sounds
            const { singleSound } = settingsRef.current;
            if (singleSound === 'soft') {
              subOsc.type = 'sine';
              fleshOsc.type = 'sine';
              duration = 0.4;
              attack = 0.08;
              subOsc.frequency.setValueAtTime(120, now);
              subOsc.frequency.exponentialRampToValueAtTime(60, now + duration);
              fleshOsc.frequency.setValueAtTime(0, now);
            }
            else if (singleSound === 'deep') {
              subOsc.type = 'sine';
              fleshOsc.type = 'sine';
              duration = 0.5;
              attack = 0.02;
              subOsc.frequency.setValueAtTime(80, now);
              subOsc.frequency.exponentialRampToValueAtTime(30, now + duration);
              fleshOsc.frequency.setValueAtTime(0, now);
            }
            else if (singleSound === 'sharp') {
              subOsc.type = 'triangle';
              fleshOsc.type = 'sine';
              duration = 0.2;
              attack = 0.005;
              subOsc.frequency.setValueAtTime(250, now);
              subOsc.frequency.exponentialRampToValueAtTime(80, now + duration);
              fleshOsc.frequency.setValueAtTime(0, now);
            }
            else if (singleSound === 'click') {
              subOsc.type = 'square';
              fleshOsc.type = 'square';
              duration = 0.05;
              attack = 0.001;
              filter.type = 'highpass';
              filter.frequency.setValueAtTime(1000, now);
              subOsc.frequency.setValueAtTime(800, now);
              subOsc.frequency.exponentialRampToValueAtTime(200, now + duration);
              fleshOsc.frequency.setValueAtTime(0, now);
            }
            else if (singleSound === 'aura') {
              subOsc.type = 'sine';
              fleshOsc.type = 'triangle';
              duration = 0.6;
              attack = 0.15;
              subOsc.frequency.setValueAtTime(150, now);
              subOsc.frequency.exponentialRampToValueAtTime(60, now + duration);
              fleshOsc.frequency.setValueAtTime(150, now);
              fleshOsc.frequency.exponentialRampToValueAtTime(60, now + duration);
              filter.type = 'lowpass';
              filter.frequency.setValueAtTime(400, now);
              filter.frequency.exponentialRampToValueAtTime(100, now + duration);
              volMult = 0.8;
            }
          }

          // Amplitude envelope
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(maxGain * volMult, now + attack);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
          
          subOsc.start(now);
          fleshOsc.start(now);
          subOsc.stop(now + duration);
          fleshOsc.stop(now + duration);
        };

        if (pulseType === 'heartbeat') {
          playSound(0, true, 'lub'); 
          playSound(0.28, true, 'dub'); 
        } else {
          playSound(0, false);
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
      if (ambientNodesRef.current?.stopAll) {
        ambientNodesRef.current.stopAll();
        ambientNodesRef.current = {};
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

          {/* Sound Variant Dropdown */}
          <div className="pt-4">
            <label className="text-sm font-medium text-slate-400 mb-2 block">
              Tipo de Sonido
            </label>
            {pulseType === 'single' ? (
              <select 
                value={singleSound}
                onChange={(e) => setSingleSound(e.target.value)}
                disabled={isPlaying}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
              >
                <option value="soft">Suave</option>
                <option value="deep">Profundo</option>
                <option value="sharp">Nítido</option>
                <option value="click">Click</option>
                <option value="aura">Aura</option>
              </select>
            ) : (
              <select 
                value={heartbeatSound}
                onChange={(e) => setHeartbeatSound(e.target.value)}
                disabled={isPlaying}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
              >
                <option value="organic">Orgánico</option>
                <option value="deep">Profundo</option>
                <option value="muffled">Apagado</option>
                <option value="strong">Fuerte</option>
                <option value="electronic">Electrónico</option>
              </select>
            )}
          </div>

          <div className="space-y-6 pt-4">
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

          {/* Ambient Sounds */}
          <div className="space-y-6 pt-6 border-t border-slate-800/50">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Sonidos Ambientales</h3>
            
            <AmbientSlider icon={<Waves />} label="Mar" value={volSea} onChange={setVolSea} />
            <AmbientSlider icon={<Wind />} label="Viento" value={volWind} onChange={setVolWind} />
            <AmbientSlider icon={<Bird />} label="Pájaros" value={volForest} onChange={setVolForest} />
            <AmbientSlider icon={<Leaf />} label="Plantas" value={volLeaves} onChange={setVolLeaves} />
            <AmbientSlider icon={<CloudRain />} label="Lluvia" value={volRain} onChange={setVolRain} />
          </div>

          {/* Output Toggles */}
          <div className="flex gap-4 pt-6 border-t border-slate-800/50">
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
