import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Keeps the camera comfortably *outside* the assembly bounding sphere.
 * Re-frames only on big extent changes (>20 % since last frame) so the user's
 * manual orbit/pan doesn't get fought; the up-vector and the spherical angles
 * of the existing camera are preserved.
 */
export function CameraFit({ extent }: { extent: number }) {
  const { camera } = useThree();
  const lastExtentRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(extent) || extent <= 0) return;
    const last = lastExtentRef.current;
    // Refit only on the first frame or when the extent changes meaningfully.
    if (last > 0 && Math.abs(extent - last) / last < 0.2) return;
    lastExtentRef.current = extent;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 40;
    // Distance so the sphere of radius `extent` fits the smaller frustum
    // dimension with a 1.4× margin.
    const wanted = (extent / Math.tan((fov * Math.PI) / 360)) * 1.4;
    const dir = camera.position.clone().normalize();
    if (dir.lengthSq() < 1e-6) dir.set(0.7, 0.55, 0.85).normalize();
    camera.position.copy(dir.multiplyScalar(wanted));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [extent, camera]);

  return null;
}
