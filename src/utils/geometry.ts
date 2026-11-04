import { WallCorner, Opening, PartitionWall, PartitionOpeningConflict, SubRoomInfo } from '../types';

export interface WallSegment {
  index: number;
  name: string;
  p1: WallCorner;
  p2: WallCorner;
  length: number; // in cm
  angleDeg: number; // angle with X axis
  internalCornerAngle: number; // corner angle with previous wall
  isCrooked: boolean;
  clearanceMinCm: number;
  clearanceMaxCm: number;
}

export interface WallClearanceInfo {
  wallIndex: number;
  wallName: string;
  minClearanceCm: number;
  maxClearanceCm: number;
  avgClearanceCm: number;
  isCrooked: boolean;
  notes: string;
}

export interface StraightenedBounds {
  squaredCorners: WallCorner[];
  originalCorners: WallCorner[];
  areaOriginalM2: number;
  areaSquaredM2: number;
  areaLostM2: number;
  deviationsDeg: number[];
  inscribedLengthCm: number;
  inscribedWidthCm: number;
  wallClearances: WallClearanceInfo[];
}

/**
 * Calculates Euclidean distance between two 2D points (in cm)
 */
export function distance2D(p1: WallCorner, p2: WallCorner): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Calculates perpendicular/minimum distance from point (px, py) to segment (ax, ay)-(bx, by) in cm
 */
export function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Calculates minimum distance from point (px, py) to any edge of the room polygon (in cm)
 */
export function distancePointToPolygonPerimeter(
  px: number,
  py: number,
  corners: WallCorner[]
): number {
  const n = corners.length;
  let minDist = Infinity;
  for (let i = 0; i < n; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % n];
    const d = distancePointToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Checks if two line segments (p1-p2) and (p3-p4) intersect in 2D
 */
export function segmentsIntersect2D(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  const ccw = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  };
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Verifies if candidate axis-aligned rectangle [x1, x2] x [y1, y2] is STRICTLY inside the room polygon
 * and maintains at least `minClearanceCm` clearance from all outer walls.
 */
export function isRectangleStrictlyInsidePolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  corners: WallCorner[],
  minClearanceCm: number = 4
): boolean {
  if (x2 <= x1 + 40 || y2 <= y1 + 40) return false;

  const rectCorners = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];

  // 1. All 4 rectangle corners must be inside polygon with >= minClearanceCm
  for (const rc of rectCorners) {
    if (!isPointInPolygon(rc.x, rc.y, corners)) return false;
    if (distancePointToPolygonPerimeter(rc.x, rc.y, corners) < minClearanceCm - 0.05) return false;
  }

  // 2. Rectangle edges must not intersect any room wall segment
  const n = corners.length;
  for (let r = 0; r < 4; r++) {
    const rc1 = rectCorners[r];
    const rc2 = rectCorners[(r + 1) % 4];

    for (let i = 0; i < n; i++) {
      const w1 = corners[i];
      const w2 = corners[(i + 1) % n];
      if (segmentsIntersect2D(rc1, rc2, w1, w2)) return false;
    }
  }

  // 3. Sample midpoints along edges to ensure clearance along entire perimeter
  const sampleSteps = 6;
  for (let r = 0; r < 4; r++) {
    const rc1 = rectCorners[r];
    const rc2 = rectCorners[(r + 1) % 4];
    for (let s = 1; s < sampleSteps; s++) {
      const t = s / sampleSteps;
      const sx = rc1.x + (rc2.x - rc1.x) * t;
      const sy = rc1.y + (rc2.y - rc1.y) * t;
      if (!isPointInPolygon(sx, sy, corners)) return false;
      if (distancePointToPolygonPerimeter(sx, sy, corners) < minClearanceCm - 0.05) return false;
    }
  }

  return true;
}

/**
 * Calculates internal angle at vertex B (between vectors BA and BC) in degrees
 */
export function vertexAngleDeg(a: WallCorner, b: WallCorner, c: WallCorner): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 90;
  
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/**
 * Calculates polygon area (Gauss shoelace formula) in m²
 */
export function polygonAreaM2(corners: WallCorner[]): number {
  if (corners.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    area += corners[i].x * corners[j].y;
    area -= corners[j].x * corners[i].y;
  }
  return Math.abs(area) / 2 / 10000; // cm² to m²
}

/**
 * Analyzes room wall geometry, lengths and internal angles
 */
export function analyzeWallSegments(corners: WallCorner[]): WallSegment[] {
  const n = corners.length;
  const segments: WallSegment[] = [];

  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];

    const len = distance2D(curr, next);
    const angleRad = Math.atan2(next.y - curr.y, next.x - curr.x);
    const angleDeg = (angleRad * 180) / Math.PI;
    const internalAngle = vertexAngleDeg(prev, curr, next);
    const isCrooked = Math.abs(internalAngle - 90) > 1.5;

    segments.push({
      index: i,
      name: `Zid ${i + 1}`,
      p1: curr,
      p2: next,
      length: Math.round(len * 10) / 10,
      angleDeg,
      internalCornerAngle: Math.round(internalAngle * 10) / 10,
      isCrooked,
      clearanceMinCm: 5,
      clearanceMaxCm: 5 + (isCrooked ? Math.round(Math.abs(internalAngle - 90) * 1.8 * 10) / 10 : 0),
    });
  }

  return segments;
}

/**
 * Computes the MAXIMUM INSCRIBED RECTANGLE (90.0° right angles) STRICTLY INSIDE an irregular / asymmetrical room polygon.
 * 
 * CRITICAL RULE:
 * The subconstruction CANNOT and MUST NOT exceed the room dimensions.
 * All 4 corners and all 4 boundary lines of the squared frame sit 100% within the room polygon
 * with a minimal clearance (default 4-5 cm) to absorb the walls' crookedness.
 */
export function computeStraightenedBounds(
  corners: WallCorner[],
  baseClearanceCm: number = 5
): StraightenedBounds {
  const n = corners.length;
  const deviations: number[] = [];
  
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];
    const ang = vertexAngleDeg(prev, curr, next);
    deviations.push(Math.round(Math.abs(ang - 90) * 10) / 10);
  }

  const isRect = checkIsRectangular(corners, 1.0);
  const minX = Math.min(...corners.map(c => c.x));
  const maxX = Math.max(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  const maxY = Math.max(...corners.map(c => c.y));
  const areaOrig = polygonAreaM2(corners);

  let bestX1 = minX + baseClearanceCm;
  let bestY1 = minY + baseClearanceCm;
  let bestX2 = maxX - baseClearanceCm;
  let bestY2 = maxY - baseClearanceCm;
  let bestArea = 0;

  if (isRect) {
    // If room is already perfectly rectangular, inward offset directly
    bestX1 = minX + baseClearanceCm;
    bestY1 = minY + baseClearanceCm;
    bestX2 = maxX - baseClearanceCm;
    bestY2 = maxY - baseClearanceCm;
    bestArea = Math.max(0, (bestX2 - bestX1) * (bestY2 - bestY1));
  } else {
    // ASYMMETRICAL ROOM: Find Global Maximum Inscribed Axis-Aligned Rectangle
    // Discretize vertical scanlines across the polygon interior
    const yStep = Math.max(2.0, (maxY - minY) / 60);
    const candidateYs: number[] = [];
    for (let y = minY + baseClearanceCm; y <= maxY - baseClearanceCm; y += yStep) {
      candidateYs.push(y);
    }

    // Precompute horizontal interior spans [leftX(y), rightX(y)] for each scanline
    const scanlineSpans: { y: number; leftX: number; rightX: number; valid: boolean }[] = [];

    for (const y of candidateYs) {
      const intersections: number[] = [];
      for (let i = 0; i < n; i++) {
        const pA = corners[i];
        const pB = corners[(i + 1) % n];
        if ((pA.y <= y && pB.y > y) || (pB.y <= y && pA.y > y)) {
          const t = (y - pA.y) / (pB.y - pA.y);
          const ix = pA.x + t * (pB.x - pA.x);
          intersections.push(ix);
        }
      }
      intersections.sort((a, b) => a - b);
      if (intersections.length >= 2) {
        const lX = intersections[0] + baseClearanceCm;
        const rX = intersections[intersections.length - 1] - baseClearanceCm;
        if (rX > lX + 40) {
          scanlineSpans.push({ y, leftX: lX, rightX: rX, valid: true });
        } else {
          scanlineSpans.push({ y, leftX: lX, rightX: rX, valid: false });
        }
      } else {
        scanlineSpans.push({ y, leftX: 0, rightX: 0, valid: false });
      }
    }

    // Double loop across scanlines to find rectangle with MAXIMUM area
    for (let i = 0; i < scanlineSpans.length; i++) {
      if (!scanlineSpans[i].valid) continue;
      const y1 = scanlineSpans[i].y;
      let currentMaxLeftX = scanlineSpans[i].leftX;
      let currentMinRightX = scanlineSpans[i].rightX;

      for (let j = i + 1; j < scanlineSpans.length; j++) {
        if (!scanlineSpans[j].valid) break; // span broken
        const y2 = scanlineSpans[j].y;
        currentMaxLeftX = Math.max(currentMaxLeftX, scanlineSpans[j].leftX);
        currentMinRightX = Math.min(currentMinRightX, scanlineSpans[j].rightX);

        if (currentMinRightX <= currentMaxLeftX + 40) break; // too narrow

        const width = currentMinRightX - currentMaxLeftX;
        const height = y2 - y1;
        const area = width * height;

        if (area > bestArea) {
          // Double verify strictly inside with edge checks
          if (isRectangleStrictlyInsidePolygon(currentMaxLeftX, y1, currentMinRightX, y2, corners, baseClearanceCm - 0.5)) {
            bestArea = area;
            bestX1 = currentMaxLeftX;
            bestY1 = y1;
            bestX2 = currentMinRightX;
            bestY2 = y2;
          }
        }
      }
    }

    // Refinement step: micro-push edges outward as much as possible without breaching clearance
    let refined = true;
    let refinePass = 0;
    while (refined && refinePass < 15) {
      refined = false;
      refinePass++;
      // Try expanding left
      if (isRectangleStrictlyInsidePolygon(bestX1 - 1, bestY1, bestX2, bestY2, corners, baseClearanceCm)) {
        bestX1 -= 1;
        refined = true;
      }
      // Try expanding right
      if (isRectangleStrictlyInsidePolygon(bestX1, bestY1, bestX2 + 1, bestY2, corners, baseClearanceCm)) {
        bestX2 += 1;
        refined = true;
      }
      // Try expanding top
      if (isRectangleStrictlyInsidePolygon(bestX1, bestY1 - 1, bestX2, bestY2, corners, baseClearanceCm)) {
        bestY1 -= 1;
        refined = true;
      }
      // Try expanding bottom
      if (isRectangleStrictlyInsidePolygon(bestX1, bestY1, bestX2, bestY2 + 1, corners, baseClearanceCm)) {
        bestY2 += 1;
        refined = true;
      }
    }
  }

  // Round coordinates to nearest 0.5 cm
  bestX1 = Math.round(bestX1 * 2) / 2;
  bestY1 = Math.round(bestY1 * 2) / 2;
  bestX2 = Math.round(bestX2 * 2) / 2;
  bestY2 = Math.round(bestY2 * 2) / 2;

  const squaredCorners: WallCorner[] = [
    { x: bestX1, y: bestY1 },
    { x: bestX2, y: bestY1 },
    { x: bestX2, y: bestY2 },
    { x: bestX1, y: bestY2 },
  ];

  const inLenCm = Math.round(Math.abs(bestX2 - bestX1));
  const inWidCm = Math.round(Math.abs(bestY2 - bestY1));
  const areaSq = Math.round((inLenCm * inWidCm) / 10000 * 100) / 100;
  const areaLost = Math.max(0, Math.round((areaOrig - areaSq) * 100) / 100);

  // Compute detailed clearance gap per wall
  const wallClearances: WallClearanceInfo[] = [];
  const frameEdges = [
    { p1: squaredCorners[0], p2: squaredCorners[1] }, // Top
    { p1: squaredCorners[1], p2: squaredCorners[2] }, // Right
    { p1: squaredCorners[2], p2: squaredCorners[3] }, // Bottom
    { p1: squaredCorners[3], p2: squaredCorners[0] }, // Left
  ];

  for (let i = 0; i < n; i++) {
    const pA = corners[i];
    const pB = corners[(i + 1) % n];
    const midX = (pA.x + pB.x) / 2;
    const midY = (pA.y + pB.y) / 2;

    // Minimum distance from wall points to the rectangular frame
    const dStart = Math.min(...frameEdges.map(e => distancePointToSegment(pA.x, pA.y, e.p1.x, e.p1.y, e.p2.x, e.p2.y)));
    const dMid = Math.min(...frameEdges.map(e => distancePointToSegment(midX, midY, e.p1.x, e.p1.y, e.p2.x, e.p2.y)));
    const dEnd = Math.min(...frameEdges.map(e => distancePointToSegment(pB.x, pB.y, e.p1.x, e.p1.y, e.p2.x, e.p2.y)));

    const cMin = Math.round(Math.min(dStart, dMid, dEnd) * 10) / 10;
    const cMax = Math.round(Math.max(dStart, dMid, dEnd) * 10) / 10;
    const cAvg = Math.round(((dStart + dMid + dEnd) / 3) * 10) / 10;
    const isCrooked = Math.abs(cMax - cMin) > 2.0;

    let notes = `Pravilan razmak ~${cAvg} cm`;
    if (isCrooked) {
      notes = `Kosi zid: zazor varira od ${cMin} cm do ${cMax} cm (kompenzirano u predzidu)`;
    }

    wallClearances.push({
      wallIndex: i,
      wallName: `Zid ${i + 1}`,
      minClearanceCm: cMin,
      maxClearanceCm: cMax,
      avgClearanceCm: cAvg,
      isCrooked,
      notes,
    });
  }

  return {
    squaredCorners,
    originalCorners: corners,
    areaOriginalM2: Math.round(areaOrig * 100) / 100,
    areaSquaredM2: areaSq,
    areaLostM2: areaLost,
    deviationsDeg: deviations,
    inscribedLengthCm: inLenCm,
    inscribedWidthCm: inWidCm,
    wallClearances,
  };
}

/**
 * Generates regular rectangular corners from length and width in cm
 */
export function generateRectangularCorners(lengthCm: number, widthCm: number): WallCorner[] {
  return [
    { x: 0, y: 0 },
    { x: lengthCm, y: 0 },
    { x: lengthCm, y: widthCm },
    { x: 0, y: widthCm },
  ];
}

/**
 * Generates sample asymmetric / trapezoid room corners
 */
export function generateAsymmetricCorners(
  lengthCm: number,
  widthCm: number,
  skewFactorCm: number = 25
): WallCorner[] {
  return [
    { x: 0, y: 0 },
    { x: lengthCm, y: -skewFactorCm * 0.4 },
    { x: lengthCm + skewFactorCm, y: widthCm + skewFactorCm * 0.6 },
    { x: 0, y: widthCm },
  ];
}

/**
 * Generates L-shaped room corners
 */
export function generateLShapedCorners(lengthCm: number, widthCm: number): WallCorner[] {
  const l1 = lengthCm;
  const w1 = widthCm;
  const cutX = lengthCm * 0.55;
  const cutY = widthCm * 0.45;

  return [
    { x: 0, y: 0 },
    { x: l1, y: 0 },
    { x: l1, y: cutY },
    { x: cutX, y: cutY },
    { x: cutX, y: w1 },
    { x: 0, y: w1 },
  ];
}

/**
 * Calculates studs positions along a line segment of length (cm),
 * ensuring full-height regular studs do NOT pass through door or window openings!
 */
export interface StudLocation {
  index: number;
  offsetCm: number;
  isSpecial: boolean; // corner, door jamb, or regular
  type: 'regular' | 'corner' | 'door_jamb_ua' | 'door_jamb_cw' | 'window_jamb';
  label?: string;
  openingId?: string;
}

export function calculateStudLocations(
  wallLengthCm: number,
  spacingMm: number,
  openingsOnWall: Opening[] = []
): StudLocation[] {
  const spacingCm = spacingMm / 10;
  const locations: StudLocation[] = [];

  // Corner start stud
  locations.push({ index: 0, offsetCm: 0, isSpecial: true, type: 'corner', label: 'Kutni spoj' });

  // Add opening jamb studs first
  const openingIntervals: { start: number; end: number; id: string; type: 'door' | 'window' }[] = [];
  openingsOnWall.forEach((op, opIdx) => {
    const leftX = Math.max(0, Math.min(wallLengthCm, op.distanceFromStart));
    const rightX = Math.max(0, Math.min(wallLengthCm, op.distanceFromStart + op.width));
    const isDoor = op.type === 'door';
    const isUA = isDoor && op.useUAProfile;

    openingIntervals.push({ start: leftX, end: rightX, id: op.id, type: op.type });

    locations.push({
      index: 100 + opIdx * 2,
      offsetCm: Math.round(leftX * 10) / 10,
      isSpecial: true,
      type: isUA ? 'door_jamb_ua' : isDoor ? 'door_jamb_cw' : 'window_jamb',
      label: `${isDoor ? 'Vrata' : 'Prozor'} - lijevi ${isUA ? 'UA ojačani' : 'CW'} stup`,
      openingId: op.id,
    });

    locations.push({
      index: 101 + opIdx * 2,
      offsetCm: Math.round(rightX * 10) / 10,
      isSpecial: true,
      type: isUA ? 'door_jamb_ua' : isDoor ? 'door_jamb_cw' : 'window_jamb',
      label: `${isDoor ? 'Vrata' : 'Prozor'} - desni ${isUA ? 'UA ojačani' : 'CW'} stup`,
      openingId: op.id,
    });
  });

  // Regular grid studs - ONLY add if they do NOT fall inside an opening interval!
  let current = spacingCm;
  let idx = 1;
  while (current < wallLengthCm - 6) {
    const roundedOffset = Math.round(current * 10) / 10;
    
    // Check if this regular stud is inside any opening
    // (with a small 4cm margin so we don't duplicate right next to jambs)
    const isInsideOpening = openingIntervals.some(
      interval => (roundedOffset >= interval.start - 4 && roundedOffset <= interval.end + 4)
    );

    if (!isInsideOpening) {
      locations.push({
        index: idx++,
        offsetCm: roundedOffset,
        isSpecial: false,
        type: 'regular',
      });
    }

    current += spacingCm;
  }

  // Corner end stud
  locations.push({
    index: 999,
    offsetCm: Math.round(wallLengthCm * 10) / 10,
    isSpecial: true,
    type: 'corner',
    label: 'Završni kut',
  });

  // Sort by offset
  locations.sort((a, b) => a.offsetCm - b.offsetCm);

  return locations;
}

/**
 * Checks if a set of corners form a rectangular room (all angles near 90°)
 */
export function checkIsRectangular(corners: WallCorner[], toleranceDeg: number = 1.0): boolean {
  if (corners.length !== 4) return false;
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];
    const ang = vertexAngleDeg(prev, curr, next);
    if (Math.abs(ang - 90) > toleranceDeg) {
      return false;
    }
  }
  return true;
}

/**
 * Parametrically updates the length of wall `wallIndex`
 * Returns new corners and whether the geometry is rectangular or asymmetric
 */
export function updateWallLengthParametric(
  corners: WallCorner[],
  wallIndex: number,
  newLengthCm: number,
  currentShape: 'rectangular' | 'asymmetric' | 'l_shaped'
): {
  newCorners: WallCorner[];
  detectedShape: 'rectangular' | 'asymmetric' | 'l_shaped';
  newLength: number;
  newWidth: number;
} {
  const n = corners.length;
  const clampedLen = Math.max(100, Math.min(3000, newLengthCm));

  if (currentShape === 'rectangular' && n === 4) {
    // In rectangular mode:
    // Wall 0 (top: (0,0)->(L,0)): adjusts length
    // Wall 1 (right: (L,0)->(L,W)): adjusts width
    // Wall 2 (bottom: (L,W)->(0,W)): adjusts length
    // Wall 3 (left: (0,W)->(0,0)): adjusts width
    const currLen = distance2D(corners[0], corners[1]);
    const currWid = distance2D(corners[1], corners[2]);
    let targetL = currLen;
    let targetW = currWid;

    if (wallIndex === 0 || wallIndex === 2) {
      targetL = clampedLen;
    } else {
      targetW = clampedLen;
    }

    const newCorners = generateRectangularCorners(targetL, targetW);
    return {
      newCorners,
      detectedShape: 'rectangular',
      newLength: Math.round(targetL),
      newWidth: Math.round(targetW),
    };
  }

  // For asymmetric room or polygon:
  // We modify vertex wallIndex+1 along the direction of wallIndex
  const p1 = corners[wallIndex];
  const p2 = corners[(wallIndex + 1) % n];
  const currentLen = distance2D(p1, p2);
  if (currentLen === 0) return { newCorners: corners, detectedShape: currentShape, newLength: clampedLen, newWidth: clampedLen };

  const dx = (p2.x - p1.x) / currentLen;
  const dy = (p2.y - p1.y) / currentLen;

  const updatedCorners = [...corners];
  const targetIdx = (wallIndex + 1) % n;
  
  // Calculate new coordinate for p2
  const newP2 = {
    x: Math.round((p1.x + dx * clampedLen) * 10) / 10,
    y: Math.round((p1.y + dy * clampedLen) * 10) / 10,
  };
  
  const shiftX = newP2.x - p2.x;
  const shiftY = newP2.y - p2.y;
  updatedCorners[targetIdx] = newP2;

  // If 4 corners and not moving p0 (origin), propagate shift or keep other points
  // Check if rectangular
  const isRect = checkIsRectangular(updatedCorners);
  const detectedShape = isRect ? 'rectangular' : 'asymmetric';

  // Bounding box dimensions
  const minX = Math.min(...updatedCorners.map(c => c.x));
  const maxX = Math.max(...updatedCorners.map(c => c.x));
  const minY = Math.min(...updatedCorners.map(c => c.y));
  const maxY = Math.max(...updatedCorners.map(c => c.y));

  return {
    newCorners: updatedCorners,
    detectedShape: currentShape === 'l_shaped' ? 'l_shaped' : detectedShape,
    newLength: Math.round(maxX - minX),
    newWidth: Math.round(maxY - minY),
  };
}

/**
 * Projects a 2D point (px, py) onto line segment (x1, y1)-(x2, y2)
 * Returns distance from (x1, y1) in cm, clamped to segment
 */
export function projectPointOntoSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { distanceAlongCm: number; t: number; projX: number; projY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const segLen = Math.sqrt(lenSq);
  if (segLen === 0) return { distanceAlongCm: 0, t: 0, projX: x1, projY: y1 };

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const distanceAlongCm = t * segLen;

  return { distanceAlongCm, t, projX, projY };
}

/**
 * Checks whether point (px, py) is strictly inside a 2D polygon (in cm or m).
 */
export function isPointInPolygon(
  px: number,
  py: number,
  polygon: { x: number; y: number }[]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-10) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes an inward-pointing offset position along the interior angle bisector of vertex B,
 * ensuring the angle badge is placed safely inside the room away from the corner vertex handle.
 */
export function getInteriorCornerBisector(
  pPrev: WallCorner,
  pCurr: WallCorner,
  pNext: WallCorner,
  offsetDistanceCm: number = 32
): { x: number; y: number } {
  // Vectors from curr to prev and curr to next
  const v1x = pPrev.x - pCurr.x;
  const v1y = pPrev.y - pCurr.y;
  const len1 = Math.hypot(v1x, v1y) || 1;
  const u1x = v1x / len1;
  const u1y = v1y / len1;

  const v2x = pNext.x - pCurr.x;
  const v2y = pNext.y - pCurr.y;
  const len2 = Math.hypot(v2x, v2y) || 1;
  const u2x = v2x / len2;
  const u2y = v2y / len2;

  // Bisector vector is the sum of unit vectors
  let bx = u1x + u2x;
  let by = u1y + u2y;
  let bLen = Math.hypot(bx, by);

  if (bLen < 0.001) {
    // Vectors are collinear (180°), pick perpendicular
    bx = -u1y;
    by = u1x;
    bLen = 1;
  }

  bx /= bLen;
  by /= bLen;

  // Test candidate point pCurr + bisector * offset
  const testP = { x: pCurr.x + bx * offsetDistanceCm, y: pCurr.y + by * offsetDistanceCm };
  return testP;
}

/**
 * Clips a horizontal or vertical line segment to the interior portions of a polygon.
 */
export function clipLineToPolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  polygon: { x: number; y: number }[]
): { x1: number; y1: number; x2: number; y2: number }[] {
  if (polygon.length < 3) return [{ x1, y1, x2, y2 }];
  
  const isHorizontal = Math.abs(y2 - y1) < 1e-5;
  const isVertical = Math.abs(x2 - x1) < 1e-5;
  
  if (!isHorizontal && !isVertical) {
    // If diagonal, fallback to center check
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return isPointInPolygon(midX, midY, polygon) ? [{ x1, y1, x2, y2 }] : [];
  }

  const intersections: number[] = [];
  const n = polygon.length;

  if (isHorizontal) {
    const yVal = y1;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);

    for (let i = 0; i < n; i++) {
      const pA = polygon[i];
      const pB = polygon[(i + 1) % n];
      if ((pA.y <= yVal && pB.y > yVal) || (pB.y <= yVal && pA.y > yVal)) {
        const t = (yVal - pA.y) / (pB.y - pA.y);
        const ix = pA.x + t * (pB.x - pA.x);
        if (ix >= minX - 0.01 && ix <= maxX + 0.01) {
          intersections.push(ix);
        }
      }
    }
    intersections.push(minX, maxX);
    intersections.sort((a, b) => a - b);

    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < intersections.length - 1; i++) {
      const segStart = intersections[i];
      const segEnd = intersections[i + 1];
      if (segEnd - segStart > 0.05) {
        const midX = (segStart + segEnd) / 2;
        if (isPointInPolygon(midX, yVal, polygon)) {
          segments.push({ x1: segStart, y1: yVal, x2: segEnd, y2: yVal });
        }
      }
    }
    return segments.length > 0 ? segments : (isPointInPolygon((x1 + x2) / 2, yVal, polygon) ? [{ x1, y1, x2, y2 }] : []);
  } else {
    // Vertical line
    const xVal = x1;
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (let i = 0; i < n; i++) {
      const pA = polygon[i];
      const pB = polygon[(i + 1) % n];
      if ((pA.x <= xVal && pB.x > xVal) || (pB.x <= xVal && pA.x > xVal)) {
        const t = (xVal - pA.x) / (pB.x - pA.x);
        const iy = pA.y + t * (pB.y - pA.y);
        if (iy >= minY - 0.01 && iy <= maxY + 0.01) {
          intersections.push(iy);
        }
      }
    }
    intersections.push(minY, maxY);
    intersections.sort((a, b) => a - b);

    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < intersections.length - 1; i++) {
      const segStart = intersections[i];
      const segEnd = intersections[i + 1];
      if (segEnd - segStart > 0.05) {
        const midY = (segStart + segEnd) / 2;
        if (isPointInPolygon(xVal, midY, polygon)) {
          segments.push({ x1: xVal, y1: segStart, x2: xVal, y2: segEnd });
        }
      }
    }
    return segments.length > 0 ? segments : (isPointInPolygon(xVal, (y1 + y2) / 2, polygon) ? [{ x1, y1, x2, y2 }] : []);
  }
}

/**
 * Validates partition walls against all doors and windows on perimeter walls.
 * Flags any collision where a partition wall intersects an opening or connects too close (<15cm) to a jamb.
 */
export function checkPartitionOpeningConflicts(
  corners: WallCorner[],
  openings: Opening[],
  partitionWalls: PartitionWall[]
): PartitionOpeningConflict[] {
  const conflicts: PartitionOpeningConflict[] = [];
  if (!partitionWalls || partitionWalls.length === 0 || !openings || openings.length === 0) {
    return conflicts;
  }

  const numCorners = corners.length;
  if (numCorners < 3) return conflicts;

  // Compute opening start and end coordinates in 2D space
  interface Opening2D {
    opening: Opening;
    wallName: string;
    pStart: { x: number; y: number };
    pEnd: { x: number; y: number };
    pMid: { x: number; y: number };
  }

  const openings2D: Opening2D[] = [];

  openings.forEach(op => {
    const wIdx = op.wallIndex % numCorners;
    const p1 = corners[wIdx];
    const p2 = corners[(wIdx + 1) % numCorners];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) return;

    const ux = dx / segLen;
    const uy = dy / segLen;

    const dStart = Math.max(0, op.distanceFromStart);
    const dEnd = Math.min(segLen, op.distanceFromStart + op.width);
    const dMid = (dStart + dEnd) / 2;

    openings2D.push({
      opening: op,
      wallName: `Zid ${wIdx + 1}`,
      pStart: { x: p1.x + ux * dStart, y: p1.y + uy * dStart },
      pEnd: { x: p1.x + ux * dEnd, y: p1.y + uy * dEnd },
      pMid: { x: p1.x + ux * dMid, y: p1.y + uy * dMid },
    });
  });

  partitionWalls.forEach(p => {
    const partP1 = { x: p.startX, y: p.startY };
    const partP2 = { x: p.endX, y: p.endY };
    const partLen = Math.hypot(partP2.x - partP1.x, partP2.y - partP1.y);
    if (partLen === 0) return;

    openings2D.forEach(op2D => {
      const op = op2D.opening;
      // 1. Check distance from partition endpoints to the opening line segment
      const distStartToOpening = distancePointToSegment(
        partP1.x,
        partP1.y,
        op2D.pStart.x,
        op2D.pStart.y,
        op2D.pEnd.x,
        op2D.pEnd.y
      );

      const distEndToOpening = distancePointToSegment(
        partP2.x,
        partP2.y,
        op2D.pStart.x,
        op2D.pStart.y,
        op2D.pEnd.x,
        op2D.pEnd.y
      );

      // 2. Check if partition line segment intersects the opening segment
      const linesIntersect = segmentsIntersect2D(
        partP1,
        partP2,
        op2D.pStart,
        op2D.pEnd
      );

      const minDist = Math.min(distStartToOpening, distEndToOpening);

      if (linesIntersect || distStartToOpening <= 15 || distEndToOpening <= 15) {
        const isDirect = linesIntersect || distStartToOpening <= 3 || distEndToOpening <= 3;
        const conflictPoint = distStartToOpening <= distEndToOpening ? partP1 : partP2;

        const opTypeLabel = op.type === 'door' ? 'vrata' : 'prozor';
        const msg = isDirect
          ? `Pregradni zid "${p.name}" se spaja izravno u otvor ${opTypeLabel}a "${op.name}" na ${op2D.wallName}. Prema normi DIN 18181 pregrada se mora spajati isključivo na čvrsti zid.`
          : `Pregradni zid "${p.name}" je preblizu otvoru ${opTypeLabel}a "${op.name}" (${minDist.toFixed(1)} cm). Preporučeni razmak od dovratnika je min. 15 cm.`;

        conflicts.push({
          partitionId: p.id,
          partitionName: p.name,
          openingId: op.id,
          openingName: op.name,
          openingType: op.type,
          wallIndex: op.wallIndex,
          wallName: op2D.wallName,
          distanceCm: Math.round(minDist * 10) / 10,
          isDirectOverlap: isDirect,
          message: msg,
          conflictPoint,
        });
      }
    });
  });

  return conflicts;
}

/**
 * Calculates separated sub-rooms created by partition walls
 * and attributes openings to each room.
 */
export function detectSubRooms(
  corners: WallCorner[],
  partitionWalls: PartitionWall[],
  openings: Opening[]
): SubRoomInfo[] {
  const totalAreaM2 = calculatePolygonArea(corners);
  const totalPerimeterM = calculatePolygonPerimeter(corners);
  const centroidMain = calculatePolygonCentroid(corners);

  // If no partition walls, single room
  if (!partitionWalls || partitionWalls.length === 0) {
    const doorsCount = openings.filter(o => o.type === 'door').length;
    const windowsCount = openings.filter(o => o.type === 'window').length;
    return [
      {
        id: 'room_1',
        name: 'Glavni prostor',
        areaM2: totalAreaM2,
        perimeterM: totalPerimeterM,
        corners: [...corners],
        centroid: centroidMain,
        openingsCount: { doors: doorsCount, windows: windowsCount },
        openings: [...openings],
        hasEntryDoor: doorsCount > 0,
        hasWindow: windowsCount > 0,
      },
    ];
  }

  // Handle single partition splitting room (most common architectural case: dividing left/right or top/bottom)
  const part = partitionWalls[0];
  const isVerticalSplit = Math.abs(part.startX - part.endX) < Math.abs(part.startY - part.endY);

  let xs = corners.map(c => c.x);
  let ys = corners.map(c => c.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (isVerticalSplit) {
    // Vertical partition at X = splitX
    const splitX = (part.startX + part.endX) / 2;
    const widthTotal = Math.max(1, maxX - minX);
    const ratio1 = Math.max(0.1, Math.min(0.9, (splitX - minX) / widthTotal));
    const ratio2 = 1 - ratio1;

    const area1 = Math.round(totalAreaM2 * ratio1 * 100) / 100;
    const area2 = Math.round(totalAreaM2 * ratio2 * 100) / 100;

    const room1Corners: WallCorner[] = [
      { x: minX, y: minY },
      { x: splitX, y: minY },
      { x: splitX, y: maxY },
      { x: minX, y: maxY },
    ];

    const room2Corners: WallCorner[] = [
      { x: splitX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: splitX, y: maxY },
    ];

    // Partition doors (connecting room 1 and room 2)
    const partDoors = (part.openings || []).filter(o => o.type === 'door');

    // Categorize outer openings by room
    const openingsRoom1: Opening[] = [];
    const openingsRoom2: Opening[] = [];

    openings.forEach(op => {
      const wIdx = op.wallIndex % corners.length;
      const p1 = corners[wIdx];
      const p2 = corners[(wIdx + 1) % corners.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.hypot(dx, dy) || 1;
      const midX = p1.x + (dx / segLen) * (op.distanceFromStart + op.width / 2);
      if (midX < splitX) {
        openingsRoom1.push(op);
      } else {
        openingsRoom2.push(op);
      }
    });

    const hasDoor1 = openingsRoom1.some(o => o.type === 'door') || partDoors.length > 0;
    const hasDoor2 = openingsRoom2.some(o => o.type === 'door') || partDoors.length > 0;
    const hasWin1 = openingsRoom1.some(o => o.type === 'window');
    const hasWin2 = openingsRoom2.some(o => o.type === 'window');

    return [
      {
        id: 'room_1',
        name: 'Soba 1 (Lijevo)',
        areaM2: area1,
        perimeterM: Math.round(((splitX - minX + (maxY - minY)) * 2 / 100) * 100) / 100,
        corners: room1Corners,
        centroid: { x: (minX + splitX) / 2, y: (minY + maxY) / 2 },
        openingsCount: {
          doors: openingsRoom1.filter(o => o.type === 'door').length + partDoors.length,
          windows: openingsRoom1.filter(o => o.type === 'window').length,
        },
        openings: openingsRoom1,
        hasEntryDoor: hasDoor1,
        hasWindow: hasWin1,
      },
      {
        id: 'room_2',
        name: 'Soba 2 (Desno)',
        areaM2: area2,
        perimeterM: Math.round(((maxX - splitX + (maxY - minY)) * 2 / 100) * 100) / 100,
        corners: room2Corners,
        centroid: { x: (splitX + maxX) / 2, y: (minY + maxY) / 2 },
        openingsCount: {
          doors: openingsRoom2.filter(o => o.type === 'door').length + partDoors.length,
          windows: openingsRoom2.filter(o => o.type === 'window').length,
        },
        openings: openingsRoom2,
        hasEntryDoor: hasDoor2,
        hasWindow: hasWin2,
      },
    ];
  } else {
    // Horizontal partition at Y = splitY
    const splitY = (part.startY + part.endY) / 2;
    const heightTotal = Math.max(1, maxY - minY);
    const ratio1 = Math.max(0.1, Math.min(0.9, (splitY - minY) / heightTotal));
    const ratio2 = 1 - ratio1;

    const area1 = Math.round(totalAreaM2 * ratio1 * 100) / 100;
    const area2 = Math.round(totalAreaM2 * ratio2 * 100) / 100;

    const room1Corners: WallCorner[] = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: splitY },
      { x: minX, y: splitY },
    ];

    const room2Corners: WallCorner[] = [
      { x: minX, y: splitY },
      { x: maxX, y: splitY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];

    const partDoors = (part.openings || []).filter(o => o.type === 'door');

    const openingsRoom1: Opening[] = [];
    const openingsRoom2: Opening[] = [];

    openings.forEach(op => {
      const wIdx = op.wallIndex % corners.length;
      const p1 = corners[wIdx];
      const p2 = corners[(wIdx + 1) % corners.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.hypot(dx, dy) || 1;
      const midY = p1.y + (dy / segLen) * (op.distanceFromStart + op.width / 2);
      if (midY < splitY) {
        openingsRoom1.push(op);
      } else {
        openingsRoom2.push(op);
      }
    });

    return [
      {
        id: 'room_1',
        name: 'Soba 1 (Sjever)',
        areaM2: area1,
        perimeterM: Math.round((((maxX - minX) + (splitY - minY)) * 2 / 100) * 100) / 100,
        corners: room1Corners,
        centroid: { x: (minX + maxX) / 2, y: (minY + splitY) / 2 },
        openingsCount: {
          doors: openingsRoom1.filter(o => o.type === 'door').length + partDoors.length,
          windows: openingsRoom1.filter(o => o.type === 'window').length,
        },
        openings: openingsRoom1,
        hasEntryDoor: openingsRoom1.some(o => o.type === 'door') || partDoors.length > 0,
        hasWindow: openingsRoom1.some(o => o.type === 'window'),
      },
      {
        id: 'room_2',
        name: 'Soba 2 (Jug)',
        areaM2: area2,
        perimeterM: Math.round((((maxX - minX) + (maxY - splitY)) * 2 / 100) * 100) / 100,
        corners: room2Corners,
        centroid: { x: (minX + maxX) / 2, y: (splitY + maxY) / 2 },
        openingsCount: {
          doors: openingsRoom2.filter(o => o.type === 'door').length + partDoors.length,
          windows: openingsRoom2.filter(o => o.type === 'window').length,
        },
        openings: openingsRoom2,
        hasEntryDoor: openingsRoom2.some(o => o.type === 'door') || partDoors.length > 0,
        hasWindow: openingsRoom2.some(o => o.type === 'window'),
      },
    ];
  }
}

