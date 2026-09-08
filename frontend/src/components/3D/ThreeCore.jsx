import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motionEngine } from '../../engine/motionPipeline';

export function ThreeCore() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 9);

    // 2. Renderer setup with high performance & pixel ratio optimization
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 3. Sacred Geometry Emblem (ALCHE Studio Pattern)
    const emblemGroup = new THREE.Group();
    scene.add(emblemGroup);

    // Outer wireframe compass rings
    const ringGeo1 = new THREE.RingGeometry(2.8, 2.82, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00d4aa, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    emblemGroup.add(ring1);

    const ringGeo2 = new THREE.RingGeometry(3.3, 3.315, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xf5c542, side: THREE.DoubleSide, transparent: true, opacity: 0.18 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    emblemGroup.add(ring2);

    // Central Prismatic Star Tetrahedron (Dual interpenetrating tetrahedrons)
    const tetGeo1 = new THREE.TetrahedronGeometry(1.6, 0);
    const tetMat1 = new THREE.MeshPhysicalMaterial({
      color: 0x00d4aa,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.8,
    });
    const tet1 = new THREE.Mesh(tetGeo1, tetMat1);
    emblemGroup.add(tet1);

    const tetGeo2 = new THREE.TetrahedronGeometry(1.6, 0);
    const tetMat2 = new THREE.MeshPhysicalMaterial({
      color: 0x9945ff, // Solana Purple
      wireframe: true,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.8,
    });
    const tet2 = new THREE.Mesh(tetGeo2, tetMat2);
    tet2.rotation.x = Math.PI; // Invert to form Star Tetrahedron / Merkaba
    emblemGroup.add(tet2);

    // Inner Glowing Core Octahedron
    const coreGeo = new THREE.OctahedronGeometry(0.7, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: false,
      transparent: true,
      opacity: 0.4,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    emblemGroup.add(core);

    // Hairline alignment coordinate crosshairs
    const lineMat = new THREE.LineBasicMaterial({ color: 0x222530, transparent: true, opacity: 0.4 });
    const pointsH = [new THREE.Vector3(-4, 0, 0), new THREE.Vector3(4, 0, 0)];
    const lineH = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsH), lineMat);
    const pointsV = [new THREE.Vector3(0, -4, 0), new THREE.Vector3(0, 4, 0)];
    const lineV = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsV), lineMat);
    emblemGroup.add(lineH);
    emblemGroup.add(lineV);

    // Three-point ambient & point lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambLight);

    const keyLight = new THREE.PointLight(0x00d4aa, 2.5, 20);
    keyLight.position.set(4, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x9945ff, 2.0, 20);
    fillLight.position.set(-4, -2, 4);
    scene.add(fillLight);

    // 4. Motion Pipeline subscription for mouse inertia spring physics
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const unsubscribe = motionEngine.subscribe(({ pointer }) => {
      targetRotX = pointer.y * 0.4;
      targetRotY = pointer.x * 0.6;
    });

    // 5. Render Loop with continuous subtle idle rotation
    let animationId;
    const clock = new THREE.Clock();

    const animate = () => {
      const delta = clock.getDelta();

      // Spring damping towards mouse coordinates
      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      // Base idle rotation + mouse inertia
      emblemGroup.rotation.x = currentRotX + (Math.sin(clock.getElapsedTime() * 0.5) * 0.05);
      emblemGroup.rotation.y = currentRotY + (clock.getElapsedTime() * 0.15);

      ring1.rotation.z += 0.002;
      ring2.rotation.z -= 0.003;
      core.rotation.y -= 0.01;

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };

    animate();

    // 6. Responsive resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      cancelAnimationFrame(animationId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30 select-none"
      aria-hidden="true"
    />
  );
}
