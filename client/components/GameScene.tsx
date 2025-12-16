import React, { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  RoundedBox,
  Environment,
  ContactShadows,
  Ring,
  Text,
} from "@react-three/drei";
import * as THREE from "three";
import { BlockData, Orientation, Player, GridState } from "@/types";
import { COLORS, GRID_SIZE, CUBE_SIZE } from "@/constants";
import { getGridBounds } from "@/utils/gameLogic";

interface BlockProps {
  id: string;
  x: number;
  y: number;
  orientation: Orientation;
  color: string;
  isGhost?: boolean;
  isValid?: boolean;
  explosion?: { position: THREE.Vector3; time: number } | null;
  physicsRegistry?: React.MutableRefObject<Map<string, PhysicsObject>>;
}

interface PhysicsObject {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  size: THREE.Vector3;
}

const Block3D: React.FC<BlockProps> = ({
  id,
  x,
  y,
  orientation,
  color,
  isGhost,
  isValid,
  explosion,
  physicsRegistry,
}) => {
  // Coords are now direct world space (scaled by CUBE_SIZE)

  let initialPosX = x * CUBE_SIZE;
  let initialPosY = y * CUBE_SIZE + CUBE_SIZE / 2; // Base sits on y=0 plane

  let sizeArgs: [number, number, number] = [1, 1, 1];

  if (orientation === "vertical") {
    sizeArgs = [CUBE_SIZE * 0.96, CUBE_SIZE * 1.96, CUBE_SIZE * 0.96];
    initialPosY += CUBE_SIZE / 2;
  } else {
    sizeArgs = [CUBE_SIZE * 1.96, CUBE_SIZE * 0.96, CUBE_SIZE * 0.96];
    initialPosX += CUBE_SIZE / 2;
  }

  const initialPosZ = 0;

  const materialColor = isGhost ? (isValid ? color : COLORS.error) : color;

  // Animation Refs
  const groupRef = useRef<THREE.Group>(null!);
  const scaleRef = useRef(isGhost ? 1 : 0);
  const scaleVel = useRef(0);
  const yOffsetRef = useRef(isGhost ? 0 : 5);
  const yVel = useRef(0);

  // Physics Refs
  const isDynamic = useRef(false);
  const position = useRef(
    new THREE.Vector3(initialPosX, initialPosY, initialPosZ)
  );
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const rotation = useRef(new THREE.Euler(0, 0, 0));
  const angularVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const lastExplosionTime = useRef(0);

  // Precompute local corners for physics collision
  const localCorners = useMemo(() => {
    const hx = sizeArgs[0] / 2;
    const hy = sizeArgs[1] / 2;
    const hz = sizeArgs[2] / 2;
    return [
      new THREE.Vector3(hx, hy, hz),
      new THREE.Vector3(hx, hy, -hz),
      new THREE.Vector3(hx, -hy, hz),
      new THREE.Vector3(hx, -hy, -hz),
      new THREE.Vector3(-hx, hy, hz),
      new THREE.Vector3(-hx, hy, -hz),
      new THREE.Vector3(-hx, -hy, hz),
      new THREE.Vector3(-hx, -hy, -hz),
    ];
  }, [sizeArgs[0], sizeArgs[1], sizeArgs[2]]);

  // Manage Physics Registry
  useEffect(() => {
    return () => {
      if (physicsRegistry && !isGhost) {
        physicsRegistry.current.delete(id);
      }
    };
  }, [id, isGhost, physicsRegistry]);

  useEffect(() => {
    if (explosion && explosion.time !== lastExplosionTime.current && !isGhost) {
      isDynamic.current = true;
      lastExplosionTime.current = explosion.time;

      // Calculate explosion force
      const bombPos = explosion.position;
      const myPos = position.current;

      const dir = new THREE.Vector3().subVectors(myPos, bombPos);
      const dist = dir.length();

      // Normalize and add some upward bias
      dir.normalize();
      dir.y += 0.8; // Push up more to get a nice arc
      dir.normalize();

      // Force magnitude falls off with distance
      const force = 35 / (dist + 0.5);

      velocity.current.add(dir.multiplyScalar(force));

      // Add random rotation
      angularVelocity.current.set(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );
    }
  }, [explosion, isGhost]);

  useFrame((state, delta) => {
    if (isGhost) return;

    // Update Registry with current state
    if (physicsRegistry) {
      physicsRegistry.current.set(id, {
        position: position.current.clone(),
        quaternion: new THREE.Quaternion().setFromEuler(rotation.current),
        size: new THREE.Vector3(...sizeArgs),
      });
    }

    if (isDynamic.current) {
      const dt = Math.min(delta, 0.05); // Cap delta time

      // Physics Constants
      const GRAVITY = -25;
      const DAMPING = 0.99;
      const ANGULAR_DAMPING = 0.98;
      const FRICTION = 0.5;
      const FLOOR_Y = 0;

      // 1. Gravity
      velocity.current.y += GRAVITY * dt;

      // 2. Predict Position for Collision
      const nextPos = position.current
        .clone()
        .addScaledVector(velocity.current, dt);

      // 3. Update Rotation (Quaternion Integration)
      const q = new THREE.Quaternion().setFromEuler(rotation.current);
      const w = angularVelocity.current;
      const wLen = w.length();
      if (wLen > 0.0001) {
        const axis = w.clone().normalize();
        const angle = wLen * dt;
        const qDelta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        q.premultiply(qDelta);
      }

      const totalForce = new THREE.Vector3(0, 0, 0);
      const totalTorque = new THREE.Vector3(0, 0, 0);
      let contactCount = 0;

      // 4a. Floor Collision (Corner Penalty Method)
      localCorners.forEach((localCorner) => {
        // Transform local corner to world space
        const worldCorner = localCorner.clone().applyQuaternion(q).add(nextPos);

        if (worldCorner.y < FLOOR_Y) {
          contactCount++;
          const depth = FLOOR_Y - worldCorner.y;

          // Velocity at contact point: v_point = v_cm + w x r
          const r = worldCorner.clone().sub(nextPos);
          const vPoint = velocity.current
            .clone()
            .add(new THREE.Vector3().crossVectors(w, r));

          const K = 300;
          const D = 15;

          const vNormal = vPoint.y; // Up is normal
          const fSpring = K * depth;
          const fDamper = -D * vNormal;

          let fY = Math.max(0, fSpring + fDamper);

          const vTangential = new THREE.Vector3(vPoint.x, 0, vPoint.z);
          const fFriction = vTangential.multiplyScalar(-FRICTION * 50 * dt);

          const force = new THREE.Vector3(0, fY, 0).add(fFriction);

          totalForce.add(force);
          totalTorque.add(new THREE.Vector3().crossVectors(r, force));
        }
      });

      // 4b. Block-Block Collision
      if (physicsRegistry) {
        physicsRegistry.current.forEach((other, otherId) => {
          if (otherId === id) return;

          // Simple Broadphase
          if (nextPos.distanceToSquared(other.position) > 16) return;

          const otherInvQ = other.quaternion.clone().invert();
          const hx = other.size.x / 2;
          const hy = other.size.y / 2;
          const hz = other.size.z / 2;

          localCorners.forEach((localCorner) => {
            const worldCorner = localCorner
              .clone()
              .applyQuaternion(q)
              .add(nextPos);

            // Transform world corner to Other's local space
            const localToOther = worldCorner
              .clone()
              .sub(other.position)
              .applyQuaternion(otherInvQ);

            // Check AABB in Other's local space
            if (
              Math.abs(localToOther.x) < hx &&
              Math.abs(localToOther.y) < hy &&
              Math.abs(localToOther.z) < hz
            ) {
              contactCount++;

              // Find smallest penetration depth
              const dx = hx - Math.abs(localToOther.x);
              const dy = hy - Math.abs(localToOther.y);
              const dz = hz - Math.abs(localToOther.z);

              // Normal in Other's Local Space
              const normalLocal = new THREE.Vector3();
              let pen = 0;

              if (dx < dy && dx < dz) {
                pen = dx;
                normalLocal.set(Math.sign(localToOther.x), 0, 0);
              } else if (dy < dz) {
                pen = dy;
                normalLocal.set(0, Math.sign(localToOther.y), 0);
              } else {
                pen = dz;
                normalLocal.set(0, 0, Math.sign(localToOther.z));
              }

              // Normal in World Space
              const normalWorld = normalLocal
                .clone()
                .applyQuaternion(other.quaternion)
                .normalize();

              // Penalty Force
              const r = worldCorner.clone().sub(nextPos);
              const vPoint = velocity.current
                .clone()
                .add(new THREE.Vector3().crossVectors(w, r));

              // Project velocity onto normal
              const vRel = vPoint.dot(normalWorld);

              const K = 400; // Stiffer for blocks
              const D = 20;

              const fMag = Math.max(0, K * pen - D * vRel);
              const force = normalWorld.multiplyScalar(fMag);

              totalForce.add(force);
              totalTorque.add(new THREE.Vector3().crossVectors(r, force));
            }
          });
        });
      }

      if (contactCount > 0) {
        velocity.current.add(totalForce.multiplyScalar(dt)); // F=ma, assume m=1
        angularVelocity.current.add(totalTorque.multiplyScalar(dt * 3)); // Approximate inertia
      }

      // 5. Integration
      velocity.current.multiplyScalar(DAMPING);
      angularVelocity.current.multiplyScalar(ANGULAR_DAMPING);
      position.current.addScaledVector(velocity.current, dt);
      rotation.current.setFromQuaternion(q);

      // 6. Stabilization (Sleep)
      if (
        contactCount > 0 &&
        velocity.current.lengthSq() < 0.02 &&
        angularVelocity.current.lengthSq() < 0.02
      ) {
        velocity.current.set(0, 0, 0);
        angularVelocity.current.set(0, 0, 0);
      }

      // Apply to mesh
      groupRef.current.position.copy(position.current);
      groupRef.current.rotation.copy(rotation.current);
    } else {
      // Standard Placement Animation
      const tension = 0.12;
      const damping = 0.6;

      const scaleDiff = 1 - scaleRef.current;
      if (Math.abs(scaleDiff) > 0.001 || Math.abs(scaleVel.current) > 0.001) {
        scaleVel.current += scaleDiff * tension;
        scaleVel.current *= damping;
        scaleRef.current += scaleVel.current;
        groupRef.current.scale.setScalar(scaleRef.current);
      }

      const yDiff = 0 - yOffsetRef.current;
      if (Math.abs(yDiff) > 0.001 || Math.abs(yVel.current) > 0.001) {
        yVel.current += yDiff * tension;
        yVel.current *= damping;
        yOffsetRef.current += yVel.current;
        groupRef.current.position.y = initialPosY + yOffsetRef.current;
      } else {
        groupRef.current.position.y = initialPosY;
      }

      // Ensure exact placement if not dynamic
      groupRef.current.position.x = initialPosX;
      groupRef.current.position.z = initialPosZ;
      groupRef.current.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={groupRef} position={[initialPosX, initialPosY, initialPosZ]}>
      <RoundedBox args={sizeArgs} radius={0.05} smoothness={4}>
        <meshStandardMaterial
          color={materialColor}
          transparent={isGhost}
          opacity={isGhost ? 0.6 : 1}
          roughness={0.7}
        />
      </RoundedBox>
      {!isGhost && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry
            args={
              orientation === "vertical" ? [1.05, 0.05, 0.5] : [0.05, 1.05, 0.5]
            }
          />
          <meshStandardMaterial color="#000" opacity={0.2} transparent />
        </mesh>
      )}
    </group>
  );
};

const WinningMarker: React.FC<{ x: number; y: number; color: string }> = ({
  x,
  y,
  color,
}) => {
  const posX = x * CUBE_SIZE;
  const posY = y * CUBE_SIZE + CUBE_SIZE / 2;
  const posZ = 0.55;

  const ringRef = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const scale = 1 + Math.sin(t * 5) * 0.1;
    if (ringRef.current) ringRef.current.scale.setScalar(scale);
  });

  return (
    <group position={[posX, posY, posZ]}>
      <Ring ref={ringRef} args={[0.15, 0.25, 32]}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </Ring>
      <pointLight distance={1.5} intensity={2} color={color} />
    </group>
  );
};

// Re-implemented GridBase that shows dynamic bounds
const DynamicGridBase: React.FC<{ blocks: BlockData[] }> = ({ blocks }) => {
  // Create a grid map to calculate bounds (could optimize by passing grid directly, but blocks is okay)
  const gridStateForBounds = useMemo(() => {
    const map = new Map();
    blocks.forEach((b) => {
      // Just populate keys for bounds calculation
      map.set(`${b.x},${b.y}`, {});
      if (b.orientation === "horizontal") map.set(`${b.x + 1},${b.y}`, {});
      else map.set(`${b.x},${b.y + 1}`, {});
    });
    return map;
  }, [blocks]);

  const { minX, maxX } = getGridBounds(gridStateForBounds);

  // Calculate Valid Range
  // The structure width is (maxX - minX) + 1.
  // Max width is GRID_SIZE (9).
  // So valid new placements must keep (newMax - newMin) + 1 <= 9.
  // The absolute left limit is: maxX - 8.
  // The absolute right limit is: minX + 8.

  // If grid is empty, allow a default range centered at 0
  const effectiveMinX = blocks.length > 0 ? minX : 0;
  const effectiveMaxX = blocks.length > 0 ? maxX : 0;

  const validStart = effectiveMaxX - (GRID_SIZE - 1);
  const validEnd = effectiveMinX + (GRID_SIZE - 1);

  // We want to visualize this range.
  // Let's draw grid lines for x from validStart to validEnd.

  const gridLines = [];

  // Vertical lines (Columns)
  // We draw lines for X boundaries of cells, so from x to x+1
  for (let x = validStart; x <= validEnd + 1; x++) {
    const xPos = x * CUBE_SIZE - CUBE_SIZE / 2;
    gridLines.push(
      <mesh key={`vline-${x}`} position={[xPos, 4.5, -0.55]}>
        <boxGeometry args={[0.02, 9, 0.02]} />
        <meshBasicMaterial color="#ffffff" opacity={0.15} transparent />
      </mesh>
    );
  }

  // Horizontal lines (Rows) - Fixed height 0 to 9
  for (let y = 0; y <= GRID_SIZE; y++) {
    const yPos = y * CUBE_SIZE;
    // Width of horizontal lines should span the dynamic width
    // Center of line:
    const width = (validEnd - validStart + 1) * CUBE_SIZE;
    const centerX =
      ((validStart + validEnd + 1) / 2) * CUBE_SIZE - CUBE_SIZE / 2;

    gridLines.push(
      <mesh
        key={`hline-${y}`}
        position={[centerX, yPos, -0.55]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <boxGeometry args={[0.02, width, 0.02]} />
        <meshBasicMaterial color="#ffffff" opacity={0.15} transparent />
      </mesh>
    );
  }

  // Highlight Limits (Red walls at the ends?)
  // Let's just put markers at the absolute limits
  const leftLimitX = validStart * CUBE_SIZE - CUBE_SIZE / 2; // Left edge of leftmost valid cell
  const rightLimitX = (validEnd + 1) * CUBE_SIZE - CUBE_SIZE / 2; // Right edge of rightmost valid cell

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={COLORS.background} />
      </mesh>

      {/* Grid Lines */}
      <group position={[0, 0, -0.1]}>{gridLines}</group>

      {/* Dynamic Limits Visuals */}
      {blocks.length > 0 && (
        <>
          {/* Left Limit Indicator */}
          <mesh position={[leftLimitX, 0, 0]}>
            <boxGeometry args={[0.05, 0.1, 1]} />
            <meshBasicMaterial color="#ef4444" opacity={0.5} transparent />
          </mesh>
          <Text
            position={[leftLimitX, -0.2, 0]}
            fontSize={0.2}
            color="#ef4444"
            anchorX="center"
          >
            LIMIT
          </Text>

          {/* Right Limit Indicator */}
          <mesh position={[rightLimitX, 0, 0]}>
            <boxGeometry args={[0.05, 0.1, 1]} />
            <meshBasicMaterial color="#ef4444" opacity={0.5} transparent />
          </mesh>
          <Text
            position={[rightLimitX, -0.2, 0]}
            fontSize={0.2}
            color="#ef4444"
            anchorX="center"
          >
            LIMIT
          </Text>
        </>
      )}

      {/* Starting Center Indicator */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 0.2]} />
        <meshBasicMaterial color="#ffffff" opacity={0.3} transparent />
      </mesh>
    </group>
  );
};

interface GameSceneProps {
  blocks: BlockData[];
  ghost: {
    x: number;
    y: number;
    orientation: Orientation;
    isValid: boolean;
  } | null;
  currentPlayer: Player;
  onHover: (x: number) => void;
  onClick: () => void;
  winningCells: { x: number; y: number }[] | null;
}

export const GameScene: React.FC<GameSceneProps> = ({
  blocks,
  ghost,
  currentPlayer,
  onHover,
  onClick,
  winningCells,
}) => {
  const dragStart = useRef({ x: 0, y: 0 });
  const controlsRef = useRef<any>(null);

  // Physics / Explosion State
  const [explosion, setExplosion] = useState<{
    position: THREE.Vector3;
    time: number;
  } | null>(null);

  // Physics Registry for Block-Block Collisions
  const physicsRegistry = useRef(new Map<string, PhysicsObject>());

  // Reset explosion when blocks are cleared (New Game)
  useEffect(() => {
    if (blocks.length === 0) {
      setExplosion(null);
      physicsRegistry.current.clear();
    }
  }, [blocks.length]);

  const handlePointerInteraction = (e: any) => {
    e.stopPropagation();
    if (winningCells || (ghost === null && blocks.length > 0 && !ghost)) {
      // If game over, maybe show cursor change?
    }

    const point = e.point;
    const gridX = Math.round(point.x / CUBE_SIZE);
    onHover(gridX);
  };

  const handlePointerDown = (e: any) => {
    dragStart.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  };

  const handlePlaneClick = (e: any) => {
    e.stopPropagation();
    const dx = e.nativeEvent.clientX - dragStart.current.x;
    const dy = e.nativeEvent.clientY - dragStart.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 10) return;

    // Check if game is won/drawn
    if (winningCells || (blocks.length > 0 && !ghost)) {
      // Explode!
      setExplosion({
        position: e.point.clone(),
        time: Date.now(),
      });
      return;
    }

    const point = e.point;
    const gridX = Math.round(point.x / CUBE_SIZE);
    onHover(gridX);

    if (e.pointerType === "mouse") {
      onClick();
    }
  };

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // Calculate target center based on blocks
    let targetX = 0;
    let targetY = 2; // Default vertical center

    if (blocks.length > 0) {
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const b of blocks) {
        const x1 = b.x;
        const x2 = b.orientation === "horizontal" ? b.x + 1 : b.x;
        const y1 = b.y;
        const y2 = b.orientation === "vertical" ? b.y + 1 : b.y;

        if (x1 < minX) minX = x1;
        if (x2 > maxX) maxX = x2;
        if (y1 < minY) minY = y1;
        if (y2 > maxY) maxY = y2;
      }

      // Geometric Center X
      targetX = ((minX + maxX) / 2) * CUBE_SIZE + CUBE_SIZE * 0.25; // Minor adjustment

      // Center Y - We calculate the visual center of the structure
      const structureCenterY = ((minY + maxY) / 2) * CUBE_SIZE;
      // We want to look slightly above the center usually, but stay grounded
      targetY = Math.max(1.5, structureCenterY + 1.0);
    }

    const damping = 3.0 * delta;

    const currentTarget = controlsRef.current.target;
    const cameraPos = state.camera.position;

    // Pan X
    const newTx = THREE.MathUtils.lerp(currentTarget.x, targetX, damping);
    const dx = newTx - currentTarget.x;
    currentTarget.x = newTx;
    cameraPos.x += dx;

    // Pan Y
    // Clamp Y target to avoid going underground or too high skyward
    const clampedTargetY = Math.max(0, Math.min(targetY, 12));
    const newTy = THREE.MathUtils.lerp(
      currentTarget.y,
      clampedTargetY,
      damping
    );
    const dy = newTy - currentTarget.y;
    currentTarget.y = newTy;
    cameraPos.y += dy;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Environment preset="city" />

      <OrbitControls
        ref={controlsRef}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2 - 0.1}
        enablePan={true}
        target={[0, 4, 0]} // Initial target
        maxDistance={40}
        minDistance={5}
      />

      <group>
        {blocks.map((b) => (
          <Block3D
            key={b.id}
            id={b.id}
            x={b.x}
            y={b.y}
            orientation={b.orientation}
            color={b.player === "white" ? COLORS.white : COLORS.black}
            explosion={explosion}
            physicsRegistry={physicsRegistry}
          />
        ))}

        {ghost && !winningCells && (
          <Block3D
            id="ghost"
            x={ghost.x}
            y={ghost.y}
            orientation={ghost.orientation}
            color={currentPlayer === "white" ? COLORS.white : COLORS.black}
            isGhost={true}
            isValid={ghost.isValid}
          />
        )}

        {winningCells &&
          winningCells.map((cell, idx) => (
            <WinningMarker
              key={`win-${idx}`}
              x={cell.x}
              y={cell.y}
              color={COLORS.highlight}
            />
          ))}

        {/* Interaction Plane */}
        <mesh
          position={[0, 4.5, 0.5]}
          visible={false}
          onPointerMove={(e) => {
            if (e.pointerType === "mouse") handlePointerInteraction(e);
          }}
          onPointerDown={handlePointerDown}
          onClick={handlePlaneClick}
        >
          <planeGeometry args={[100, 20]} />
        </mesh>

        <DynamicGridBase blocks={blocks} />

        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.5}
          scale={50}
          blur={2}
          far={4}
        />
      </group>
    </>
  );
};
