import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { sound } from '../../engine/soundFX';
import { useBotStore } from '../../stores/botStore';

export function TokenInspectionModal({ coin, onClose, onQuickBuy }) {
  const mountRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [buying, setBuying] = useState(false);
  const addNotification = useBotStore(s => s.addNotification);

  useEffect(() => {
    sound.playTurntableHum();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    const container = mountRef.current;
    if (!container) return;

    // 1. Dedicated Studio Three.js Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 50);
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // 2. Three-Point Studio Lighting Matrix (Getty Persepolis Pattern)
    // Key Light: Warm directional light (3200K)
    const keyLight = new THREE.DirectionalLight(0xffe8d6, 3.2);
    keyLight.position.set(4, 5, 4);
    scene.add(keyLight);

    // Fill Light: Soft cool light (6500K)
    const fillLight = new THREE.DirectionalLight(0xd6e8ff, 1.2);
    fillLight.position.set(-4, 2, 2);
    scene.add(fillLight);

    // Rim Light: Sharp cyan/specular accent (10000K)
    const rimLight = new THREE.DirectionalLight(0x00d4aa, 3.8);
    rimLight.position.set(0, 3, -5);
    scene.add(rimLight);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambLight);

    // 3. Artifact Geometry: 3D Metallic Coin Medallion with Ribbed Edge
    const coinGroup = new THREE.Group();
    scene.add(coinGroup);

    // Main Coin Cylinder
    const coinGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.18, 64);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0x1f232d,
      metalness: 0.88,
      roughness: 0.22,
    });
    const coinMesh = new THREE.Mesh(coinGeo, coinMat);
    coinMesh.rotation.x = Math.PI / 2;
    coinGroup.add(coinMesh);

    // Gold Outer Rim Bevel
    const rimGeo = new THREE.TorusGeometry(1.62, 0.05, 16, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xf5c542,
      metalness: 0.95,
      roughness: 0.15,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    coinGroup.add(rimMesh);

    // Inner Solana Cyan Accent Ring
    const innerRimGeo = new THREE.TorusGeometry(1.4, 0.03, 16, 64);
    const innerRimMat = new THREE.MeshStandardMaterial({
      color: 0x00d4aa,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x00d4aa,
      emissiveIntensity: 0.2,
    });
    const innerRim = new THREE.Mesh(innerRimGeo, innerRimMat);
    coinGroup.add(innerRim);

    // Center Embossed Token Symbol Plate
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#14161d';
    ctx.fillRect(0, 0, 512, 512);

    // Draw embossed symbol on coin face
    ctx.fillStyle = '#00d4aa';
    ctx.font = 'bold 120px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((coin.symbol || '?').slice(0, 5), 256, 256);

    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(256, 256, 220, 0, Math.PI * 2);
    ctx.stroke();

    const faceTexture = new THREE.CanvasTexture(canvas);
    const faceGeo = new THREE.CircleGeometry(1.38, 48);
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTexture,
      metalness: 0.8,
      roughness: 0.3,
    });

    const frontFace = new THREE.Mesh(faceGeo, faceMat);
    frontFace.position.z = 0.095;
    coinGroup.add(frontFace);

    const backFace = new THREE.Mesh(faceGeo, faceMat);
    backFace.position.z = -0.095;
    backFace.rotation.y = Math.PI;
    coinGroup.add(backFace);

    // 4. Interactive 360° Drag Turntable Kinematics with Spring Friction
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotVelX = 0;
    let rotVelY = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
      prevMouseY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
      sound.playClick(800, 0.02);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;

      const deltaX = clientX - prevMouseX;
      const deltaY = clientY - prevMouseY;

      rotVelY = deltaX * 0.008;
      rotVelX = deltaY * 0.008;

      coinGroup.rotation.y += rotVelY;
      coinGroup.rotation.x += rotVelX;

      prevMouseX = clientX;
      prevMouseY = clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // 5. Render Loop with Inertial Friction & Idle Spin
    let animId;
    const animate = () => {
      if (!isDragging) {
        // Friction decay
        rotVelX *= 0.94;
        rotVelY *= 0.94;
        coinGroup.rotation.x += rotVelX;
        coinGroup.rotation.y += rotVelY;

        // Idle auto-spin
        coinGroup.rotation.y += 0.006;
        coinGroup.rotation.x += (0.15 - coinGroup.rotation.x) * 0.05;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      dom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      cancelAnimationFrame(animId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [coin]);

  const copyMint = () => {
    if (coin.address) {
      navigator.clipboard.writeText(coin.address);
      setCopied(true);
      sound.playClick();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleQuickBuy = async () => {
    setBuying(true);
    sound.playHoloPing();
    try {
      if (onQuickBuy) {
        await onQuickBuy(coin);
      } else {
        addNotification({
          type: 'info',
          text: `Quick Buy triggered for ${coin.symbol} (0.1 SOL)`,
        });
      }
    } finally {
      setBuying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#06080ce6] backdrop-blur-xl animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#0f1117] border border-[#262c3b] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 text-gray-400 hover:text-white p-1.5 rounded-lg bg-[#181c26] border border-[#2a3142] transition-colors"
          title="Close (Esc)"
        >
          ✕
        </button>

        {/* Left Column: 3D Turntable Studio */}
        <div className="relative h-72 md:h-[480px] bg-gradient-to-b from-[#12151e] to-[#0a0c10] flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#262c3b]">
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
          
          <div className="absolute bottom-3 text-center pointer-events-none">
            <span className="text-[10px] text-gray-500 font-mono tracking-wider uppercase bg-[#14172080] px-3 py-1 rounded-full border border-[#222736]">
              360° Studio Turntable · Drag to Rotate
            </span>
          </div>
        </div>

        {/* Right Column: Curatorial Editorial Plaque (Getty Persepolis Pattern) */}
        <div className="p-6 flex flex-col justify-between space-y-4">
          <div>
            {/* Header / Badges */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                (coin.devRugPercent ?? 0) < 20 ? 'bg-gmgn-green/20 text-gmgn-green border border-gmgn-green/30' : 'bg-gmgn-red/20 text-gmgn-red border border-gmgn-red/30'
              }`}>
                {(coin.devRugPercent ?? 0) < 20 ? '🛡️ Low Risk Tier' : '⚡ High Profit Tier'}
              </span>

              <span className="text-[10px] font-mono text-gmgn-yellow bg-[#f5c54215] px-2 py-0.5 rounded border border-[#f5c54230]">
                {coin.rankReason || 'Ranked Coin'}
              </span>
            </div>

            {/* Token Title & Mint */}
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              {coin.symbol}
              <span className="text-sm font-normal text-gray-400">({coin.name})</span>
            </h2>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-gray-500 truncate max-w-[220px]">
                {coin.address}
              </span>
              <button
                onClick={copyMint}
                className="text-[10px] text-gmgn-accent hover:underline font-mono"
              >
                {copied ? '✓ Copied' : 'Copy Mint'}
              </button>
            </div>

            {/* Live Stats Dossier */}
            <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-[#141722] rounded-xl border border-[#222838] text-xs">
              <div>
                <span className="text-[10px] text-gray-400 block">Market Cap</span>
                <span className="font-bold text-white">${(coin.mktCapK ?? 0).toLocaleString()}K</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Liquidity</span>
                <span className="font-bold text-white">${(coin.liquidityK ?? 0).toLocaleString()}K</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">24h Volume</span>
                <span className="font-bold text-white">${(coin.volumeK ?? 0).toLocaleString()}K</span>
              </div>

              <div className="mt-2">
                <span className="text-[10px] text-gray-400 block">Net Buy</span>
                <span className={`font-bold ${(coin.netBuyK ?? 0) >= 0 ? 'text-gmgn-green' : 'text-gmgn-red'}`}>
                  {(coin.netBuyK ?? 0) >= 0 ? '+' : ''}{(coin.netBuyK ?? 0).toLocaleString()}K
                </span>
              </div>
              <div className="mt-2">
                <span className="text-[10px] text-gray-400 block">Total TXs</span>
                <span className="font-bold text-white">{(coin.txs ?? 0).toLocaleString()}</span>
              </div>
              <div className="mt-2">
                <span className="text-[10px] text-gray-400 block">Token Age</span>
                <span className="font-bold text-white">{coin.ageMinutes ?? 0} min</span>
              </div>
            </div>

            {/* Dev Dossier Monograph */}
            <div className="mt-4 p-3 bg-[#11131a] rounded-xl border border-[#1e2330]">
              <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Developer On-Chain Dossier</span>
                <span className="text-gmgn-yellow font-mono">
                  ${Math.round(coin.devTotalValueUsd ?? (coin.devBalanceSol || 0) * 150).toLocaleString()} Net Worth
                </span>
              </div>

              <div className="text-xs text-gray-400 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Creator Address:</span>
                  <span className="text-gray-300">
                    {coin.devAddress ? `${coin.devAddress.slice(0, 6)}...${coin.devAddress.slice(-4)}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>SOL Holdings:</span>
                  <span className="text-gray-300">{(coin.devBalanceSol ?? 0).toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span>Historical Rug Risk:</span>
                  <span className={(coin.devRugPercent ?? 0) < 20 ? 'text-gmgn-green' : 'text-gmgn-red'}>
                    {(coin.devRugPercent ?? 0).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Launches:</span>
                  <span className="text-gray-300">{coin.devTotalLaunches ?? 1} launch(es)</span>
                </div>
                <div className="flex justify-between">
                  <span>Pre-Launch Funding:</span>
                  <span className={coin.isPreFunded ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
                    {coin.isPreFunded
                      ? `+${coin.preFundAmountSol} SOL (${coin.funderWallet ? coin.funderWallet.slice(0, 4) + '...' + coin.funderWallet.slice(-4) : 'Verified'})`
                      : (coin.devBalanceSol >= 5 ? `Self-Funded (${coin.devBalanceSol.toFixed(1)} SOL)` : 'No External Inflow')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Historical Avg ATH:</span>
                  <span className="text-gmgn-accent font-bold">
                    {coin.devHistoricalAvgAth ? `$${coin.devHistoricalAvgAth.toLocaleString()}K` : '1st Launch (No ATH History)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ATH Probability Score:</span>
                  <span className={`font-bold ${
                    (coin.athReachProbability || 50) >= 70 ? 'text-emerald-400' : 'text-gmgn-yellow'
                  }`}>
                    {coin.athReachProbability || 50}% Estimated Chance
                  </span>
                </div>
                {coin.hasGenuineWebsite && coin.websiteUrl && (
                  <div className="flex justify-between">
                    <span>Verified Website:</span>
                    <a
                      href={coin.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gmgn-accent underline hover:text-white"
                    >
                      {coin.websiteDomain} ↗
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Bonding Curve Progress Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[11px] font-mono text-gray-400 mb-1">
                <span>Bonding Curve Progress</span>
                <span className="text-gmgn-accent font-bold">{(coin.bCurvePercent ?? 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1a1d26] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gmgn-accent to-gmgn-yellow transition-all duration-500"
                  style={{ width: `${Math.min(100, coin.bCurvePercent ?? 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-3 border-t border-[#222838] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <a
                href={coin.dexUrl || `https://dexscreener.com/solana/${coin.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gmgn-accent hover:underline"
              >
                DexScreener ↗
              </a>
              <span className="text-gray-600">·</span>
              <a
                href={`https://gmgn.ai/sol/token/${coin.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white"
              >
                GMGN ↗
              </a>
              <span className="text-gray-600">·</span>
              <a
                href={`https://solscan.io/token/${coin.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white"
              >
                Solscan ↗
              </a>
            </div>

            {/* Quick Buy CTA */}
            <button
              onClick={handleQuickBuy}
              disabled={buying}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-gmgn-accent to-[#00b08b] text-black hover:opacity-90 transition-all shadow-lg shadow-gmgn-accent/20 active:scale-95"
            >
              {buying ? 'Executing...' : '⚡ Quick Buy 0.1 SOL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
