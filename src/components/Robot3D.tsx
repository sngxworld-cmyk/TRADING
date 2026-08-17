import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface Robot3DProps {
  size?: number; // size in px
  isInteractive?: boolean;
  isTalking?: boolean;
  expression?: "happy" | "thinking" | "neutral";
  className?: string;
}

export const Robot3D: React.FC<Robot3DProps> = ({
  size = 180,
  isInteractive = true,
  isTalking = false,
  expression = "happy",
  className = "",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Clear previous canvas if any
    container.innerHTML = "";

    const width = size;
    const height = size;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x6366f1, 3.0); // Indigo key light
    dirLight1.position.set(3, 4, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 2.5); // Cyan fill light
    dirLight2.position.set(-3, -2, 3);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x38bdf8, 2, 10); // Center core glow
    pointLight.position.set(0, -0.2, 1);
    scene.add(pointLight);

    // Robot Master Group
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // --- MATERIALS ---
    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.1,
    });

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Cyan neon
    });

    const eyeGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    const earLightMaterial = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
    });

    // --- 1. ROBOT HEAD ---
    const headGroup = new THREE.Group();

    // Head Base Box with Rounded Edges look
    const headGeo = new THREE.BoxGeometry(1.5, 1.2, 1.2);
    const headMesh = new THREE.Mesh(headGeo, armorMaterial);
    headGroup.add(headMesh);

    // Visor Shield (Black Glossy glass)
    const visorGeo = new THREE.BoxGeometry(1.3, 0.55, 0.1);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.05,
      metalness: 0.9,
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 0.1, 0.61);
    headGroup.add(visorMesh);

    // Dual Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(0.35, 0.12, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeGlowMaterial);
    leftEye.position.set(-0.32, 0.1, 0.65);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeGlowMaterial);
    rightEye.position.set(0.32, 0.1, 0.65);
    headGroup.add(rightEye);

    // Antenna
    const antennaStemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12);
    const antennaStem = new THREE.Mesh(antennaStemGeo, chromeMaterial);
    antennaStem.position.set(0, 0.85, 0);
    headGroup.add(antennaStem);

    const antennaOrbGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const antennaOrb = new THREE.Mesh(antennaOrbGeo, glowMaterial);
    antennaOrb.position.set(0, 1.15, 0);
    headGroup.add(antennaOrb);

    // Side Ears / Audio Receivers
    const earGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16);
    earGeo.rotateZ(Math.PI / 2);

    const leftEar = new THREE.Mesh(earGeo, earLightMaterial);
    leftEar.position.set(-0.8, 0.1, 0);
    headGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, earLightMaterial);
    rightEar.position.set(0.8, 0.1, 0);
    headGroup.add(rightEar);

    headGroup.position.y = 0.5;
    robotGroup.add(headGroup);

    // --- 2. ROBOT BODY & CORE ---
    const bodyGroup = new THREE.Group();

    // Chest Body
    const chestGeo = new THREE.SphereGeometry(0.85, 24, 24);
    chestGeo.scale(1, 0.9, 0.8);
    const chestMesh = new THREE.Mesh(chestGeo, armorMaterial);
    bodyGroup.add(chestMesh);

    // Chest Arc Reactor / Core Light
    const coreRingGeo = new THREE.TorusGeometry(0.3, 0.05, 16, 32);
    const coreRing = new THREE.Mesh(coreRingGeo, chromeMaterial);
    coreRing.position.set(0, 0, 0.65);
    bodyGroup.add(coreRing);

    const coreLightGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const coreLight = new THREE.Mesh(coreLightGeo, glowMaterial);
    coreLight.position.set(0, 0, 0.62);
    bodyGroup.add(coreLight);

    // Floating Base / Thruster Ring
    const ringGeo = new THREE.TorusGeometry(0.7, 0.04, 16, 40);
    const ringMesh = new THREE.Mesh(ringGeo, glowMaterial);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -0.9;
    bodyGroup.add(ringMesh);

    bodyGroup.position.y = -0.6;
    robotGroup.add(bodyGroup);

    // --- MOUSE & ANIMATION LOOPS ---
    const handleMouseMove = (e: MouseEvent) => {
      if (!isInteractive) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current = { x, y };
    };

    window.addEventListener("mousemove", handleMouseMove);

    let animationFrameId: number;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = (performance.now() - startTime) / 1000;

      // Floating hover motion
      robotGroup.position.y = Math.sin(elapsedTime * 2.5) * 0.12;
      robotGroup.rotation.z = Math.sin(elapsedTime * 1.5) * 0.05;

      // Pulse core & antenna lights
      const pulse = (Math.sin(elapsedTime * 4) + 1) / 2;
      antennaOrb.scale.setScalar(0.9 + pulse * 0.25);
      pointLight.intensity = 1.5 + pulse * 1.0;

      // Talking eye pulse
      if (isTalking) {
        const talkPulse = Math.abs(Math.sin(elapsedTime * 10));
        leftEye.scale.y = 0.5 + talkPulse * 0.8;
        rightEye.scale.y = 0.5 + talkPulse * 0.8;
      } else {
        leftEye.scale.y = 1;
        rightEye.scale.y = 1;
      }

      // Head look-at cursor
      const targetRotY = mouseRef.current.x * 0.4;
      const targetRotX = -mouseRef.current.y * 0.3;

      headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * 0.08;
      headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * 0.08;
      robotGroup.rotation.y += (mouseRef.current.x * 0.2 - robotGroup.rotation.y) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [size, isInteractive, isTalking, expression]);

  return (
    <div
      ref={mountRef}
      className={`relative flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
