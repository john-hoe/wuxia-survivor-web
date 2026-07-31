export type GeometryPoint = {
  x: number;
  y: number;
};

/**
 * Returns the first point where a swept segment enters a circle.
 * A segment that starts inside the circle intersects at its start point.
 */
export function getSegmentCircleFirstIntersection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  circleX: number,
  circleY: number,
  radius: number
): GeometryPoint | undefined {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  const clampedRadius = Math.max(0, radius);
  const offsetX = startX - circleX;
  const offsetY = startY - circleY;
  const radiusSquared = clampedRadius * clampedRadius;

  if (offsetX * offsetX + offsetY * offsetY <= radiusSquared) {
    return { x: startX, y: startY };
  }
  if (lengthSquared <= 0) {
    return undefined;
  }

  const b = 2 * (offsetX * dx + offsetY * dy);
  const c = offsetX * offsetX + offsetY * offsetY - radiusSquared;
  const discriminant = b * b - 4 * lengthSquared * c;
  if (discriminant < 0) {
    return undefined;
  }

  const entryRatio = (-b - Math.sqrt(discriminant)) / (2 * lengthSquared);
  if (entryRatio < 0 || entryRatio > 1) {
    return undefined;
  }
  return {
    x: startX + dx * entryRatio,
    y: startY + dy * entryRatio
  };
}

/** Swept collision test that also handles a stationary segment. */
export function segmentIntersectsCircle(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  circleX: number,
  circleY: number,
  radius: number
): boolean {
  return getSegmentCircleFirstIntersection(
    startX,
    startY,
    endX,
    endY,
    circleX,
    circleY,
    radius
  ) !== undefined;
}
