import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface SolarPanelsProps {
  roofType: string;
  width?: number;
  height?: number;
}

const House = ({ roofType }: { roofType: string }) => {
  const roofGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    let vertices;
    let indices;

    switch (roofType) {
      case 'flat':
        vertices = new Float32Array([
          -2, 0, -2,  // 0
          2, 0, -2,   // 1
          2, 0, 2,    // 2
          -2, 0, 2,   // 3
        ]);
        indices = new Uint16Array([
          0, 1, 2,
          0, 2, 3
        ]);
        break;

      case 'mono':
        vertices = new Float32Array([
          -2, 0, -2,    // 0
          2, 1.5, -2,   // 1
          2, 1.5, 2,    // 2
          -2, 0, 2,     // 3
        ]);
        indices = new Uint16Array([
          0, 1, 2,
          0, 2, 3
        ]);
        break;

      case 'dual':
        vertices = new Float32Array([
          -2, 0, -2,    // 0
          2, 0, -2,     // 1
          0, 1.5, -2,   // 2
          -2, 0, 2,     // 3
          2, 0, 2,      // 4
          0, 1.5, 2,    // 5
        ]);
        indices = new Uint16Array([
          0, 2, 1,
          3, 5, 4,
          0, 3, 5, 0, 5, 2,
          1, 2, 5, 1, 5, 4
        ]);
        break;

      case 'quad':
        vertices = new Float32Array([
          -2, 0, -2,    // 0
          2, 0, -2,     // 1
          2, 0, 2,      // 2
          -2, 0, 2,     // 3
          0, 1.5, 0,    // 4
        ]);
        indices = new Uint16Array([
          0, 4, 1,
          1, 4, 2,
          2, 4, 3,
          3, 4, 0
        ]);
        break;

      default:
        vertices = new Float32Array([
          -2, 0, -2,
          2, 0, -2,
          2, 0, 2,
          -2, 0, 2,
        ]);
        indices = new Uint16Array([
          0, 1, 2,
          0, 2, 3
        ]);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    return geometry;
  }, [roofType]);

  return (
    <group>
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color="#e5e5e5" />
      </mesh>
      
      <mesh geometry={roofGeometry}>
        <meshStandardMaterial color="#8b4513" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const SolarPanel = ({ position, rotation = [-Math.PI / 6, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) => {
  const panelRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={panelRef} position={position} rotation={rotation}>
      <boxGeometry args={[1, 0.05, 1.6]} />
      <meshStandardMaterial color="#1a365d" />
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.9, 0.01, 1.5]} />
        <meshStandardMaterial color="#4a90e2" />
      </mesh>
    </mesh>
  );
};

const Scene = ({ roofType }: { roofType: string }) => {
  const solarPanels = useMemo(() => {
    const panels = [];
    const panelWidth = 1.2;
    const panelHeight = 1.8;
    const spacing = 0.2;
    
    const getPanelRotation = (): [number, number, number] => {
      switch (roofType) {
        case 'flat':
          return [-Math.PI / 6, 0, 0];
        case 'mono':
          return [-Math.PI / 4, 0, 0];
        case 'dual':
          return [-Math.PI / 4, 0, 0];
        case 'quad':
          return [-Math.PI / 4, 0, 0];
        default:
          return [-Math.PI / 6, 0, 0];
      }
    };

    const getPanelPosition = (i: number, j: number): [number, number, number] => {
      switch (roofType) {
        case 'flat':
          return [
            -1.5 + i * (panelWidth + spacing),
            0.1,
            -1.5 + j * (panelHeight + spacing)
          ];
        case 'mono':
          return [
            -1.5 + i * (panelWidth + spacing),
            0.5 + (i * 0.2),
            -1.5 + j * (panelHeight + spacing)
          ];
        case 'dual':
          const side = i < 1 ? -1 : 1;
          return [
            -1.5 + i * (panelWidth + spacing),
            0.8,
            -1.5 + j * (panelHeight + spacing)
          ];
        case 'quad':
          return [
            -1.5 + i * (panelWidth + spacing),
            0.8,
            -1.5 + j * (panelHeight + spacing)
          ];
        default:
          return [
            -1.5 + i * (panelWidth + spacing),
            0.1,
            -1.5 + j * (panelHeight + spacing)
          ];
      }
    };
    
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        panels.push(
          <SolarPanel
            key={`panel-${i}-${j}`}
            position={getPanelPosition(i, j)}
            rotation={getPanelRotation()}
          />
        );
      }
    }
    return panels;
  }, [roofType]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <House roofType={roofType} />
      {solarPanels}
    </>
  );
};

const SolarPanels: React.FC<SolarPanelsProps> = ({ roofType, width = 600, height = 400 }) => {
  return (
    <div style={{ width, height }} className="rounded-lg overflow-hidden border border-gray-300">
      <Canvas
        camera={{ position: [8, 5, 8], fov: 50 }}
        shadows
      >
        <Scene roofType={roofType} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
};

export default SolarPanels;