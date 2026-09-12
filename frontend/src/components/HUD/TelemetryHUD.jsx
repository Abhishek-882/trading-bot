import React, { useState, useEffect } from 'react';
import { motionEngine } from '../../engine/motionPipeline';
import { sound } from '../../engine/soundFX';

export function TelemetryHUD() {
  const [telemetry, setTelemetry] = useState({
    pitch: 0,
    yaw: 0,
    roll: 0,
    x: 0,
    y: 0,
    fps: 60,
  });
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [isEco, setIsEco] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let currentFps = 60;

    const unsubscribe = motionEngine.subscribe(({ pointer }) => {
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;
      }

      setTelemetry({
        pitch: pointer.pitch,
        yaw: pointer.yaw,
        roll: pointer.roll,
        x: pointer.x,
        y: pointer.y,
        fps: Math.min(144, currentFps),
      });
    });

    return () => unsubscribe();
  }, []);

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleEco = () => {
    const nextEco = !isEco;
    setIsEco(nextEco);
    motionEngine.setEcoMode(nextEco);
    sound.playClick();
  };

  return (
    <>
      {/* ── Mobile Compact Floating Telemetry Pill (Viewport < 768px) ── */}
      <div className="fixed bottom-3 right-3 z-40 select-none font-mono text-[10px] block md:hidden">
        <div className="bg-[#101217e6] backdrop-blur-md border border-[#252a36] rounded-full px-2.5 py-1 shadow-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gmgn-accent animate-pulse" />
          <span className="text-gmgn-accent font-bold text-[10px]">{telemetry.fps} FPS</span>
          <button
            onClick={handleToggleSound}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="text-gray-400 hover:text-white transition-colors p-0.5"
          >
            {isMuted ? (
              <svg className="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Desktop Gimbal Panel (Viewport >= 768px) ── */}
      <div className="fixed top-3 right-4 z-40 select-none font-mono text-[10px] hidden md:block">
        <div className="bg-[#101217e6] backdrop-blur-md border border-[#252a36] rounded-xl p-2.5 shadow-2xl transition-all duration-300 w-56">
          {/* HUD Top Bar */}
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#252a36]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gmgn-accent animate-pulse" />
              <span className="text-gray-300 font-bold uppercase tracking-wider text-[9px]">Telemetry HUD</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Audio Toggle (Vector SVG, zero emojis) */}
              <button
                onClick={handleToggleSound}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isMuted ? (
                  <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>

              {/* Eco Throttle Toggle */}
              <button
                onClick={handleToggleEco}
                title={isEco ? 'Disable Eco Mode (60/120 FPS)' : 'Enable Eco Mode (30 FPS throttle)'}
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors ${
                  isEco
                    ? 'bg-gmgn-accent text-black border-gmgn-accent'
                    : 'bg-[#181c24] text-gray-400 border-[#2d3342] hover:text-white'
                }`}
              >
                ECO
              </button>

              {/* Collapse Toggle */}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-gray-500 hover:text-gray-300 text-xs px-1"
              >
                {isCollapsed ? '+' : '−'}
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {!isCollapsed && (
            <div className="space-y-2">
              {/* Dynamic Gimbal Reticle */}
              <div className="flex items-center justify-between bg-[#0c0e12] p-2 rounded-lg border border-[#1d212b]">
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8 rounded-full border border-gmgn-accent/40 flex items-center justify-center">
                    <div
                      className="absolute w-2 h-2 rounded-full bg-gmgn-accent transition-transform duration-75"
                      style={{
                        transform: `translate(${telemetry.x * 10}px, ${telemetry.y * 10}px)`,
                      }}
                    />
                    {/* Crosshair reticle */}
                    <div className="absolute w-full h-[1px] bg-gmgn-accent/20" />
                    <div className="absolute h-full w-[1px] bg-gmgn-accent/20" />
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-400">PITCH: {telemetry.pitch.toFixed(1)}°</div>
                    <div className="text-[9px] text-gray-400">YAW: {telemetry.yaw.toFixed(1)}°</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[9px] text-gmgn-accent font-bold">{telemetry.fps} FPS</div>
                  <div className="text-[8px] text-gray-500">2,480 TPS</div>
                </div>
              </div>

              {/* Spatial Vector Coordinates */}
              <div className="grid grid-cols-2 gap-1 text-[9px] text-gray-400">
                <div className="bg-[#0c0e12] px-1.5 py-1 rounded border border-[#1d212b] flex justify-between">
                  <span>COORD X:</span>
                  <span className="text-gray-200 font-mono">
                    {telemetry.x >= 0 ? '+' : ''}{telemetry.x.toFixed(2)}
                  </span>
                </div>
                <div className="bg-[#0c0e12] px-1.5 py-1 rounded border border-[#1d212b] flex justify-between">
                  <span>COORD Y:</span>
                  <span className="text-gray-200 font-mono">
                    {telemetry.y >= 0 ? '+' : ''}{telemetry.y.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Protocol Status Bar */}
              <div className="flex items-center justify-between text-[8px] text-gray-500 pt-0.5 border-t border-[#1d212b]">
                <span>SOLANA MAINNET</span>
                <span className="text-gmgn-green">SYNCED (30s)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default TelemetryHUD;
