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
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  const rawProjection = lengthSquared > 0
    ? ((circleX - startX) * dx + (circleY - startY) * dy) / lengthSquared
    : 0;
  const projection = Math.min(1, Math.max(0, rawProjection));
  const closestX = startX + dx * projection;
  const closestY = startY + dy * projection;
  return Math.hypot(circleX - closestX, circleY - closestY) <= Math.max(0, radius);
}
