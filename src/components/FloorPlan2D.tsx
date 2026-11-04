import React, { useState, useRef, useEffect } from 'react';
import { RoomConfig, Opening, PartitionWall, WallCorner } from '../types';
import { 
  analyzeWallSegments, 
  computeStraightenedBounds, 
  calculateStudLocations,
  updateWallLengthParametric,
  projectPointOntoSegment,
  checkIsRectangular,
  getInteriorCornerBisector,
  checkPartitionOpeningConflicts,
  detectSubRooms
} from '../utils/geometry';
import { NumericInput } from './NumericInput';
import { 
  Ruler, 
  DoorClosed, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Layers, 
  Sparkles,
  Move,
  CheckCircle2,
  HelpCircle,
  Wrench,
  Square,
  Maximize2,
  Check,
  X,
  RotateCcw,
  Sliders,
  ChevronRight
} from 'lucide-react';

interface FloorPlan2DProps {
  config: RoomConfig;
  onChange?: (newConfig: RoomConfig) => void;
}

export const FloorPlan2D: React.FC<FloorPlan2DProps> = ({ config, onChange }) => {
  const [selectedWallIndex, setSelectedWallIndex] = useState<number | null>(0);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [showStudLabels, setShowStudLabels] = useState(true);
  const [showKote, setShowKote] = useState(true);
  const [showClearanceGaps, setShowClearanceGaps] = useState(true);

  // Draft / Proposed Geometry State for "Move -> Preview -> Confirm" workflow
  const [draftCorners, setDraftCorners] = useState<WallCorner[] | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  // Dragging state for openings or corners
  const [draggingOpeningId, setDraggingOpeningId] = useState<string | null>(null);
  const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null);

  // Popover mode on preview ('wall' | 'opening' | null)
  const [previewEditorMode, setPreviewEditorMode] = useState<'wall' | 'opening' | null>('wall');

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Active corners to display (draft if moving, otherwise committed config corners)
  const activeCorners = draftCorners || config.corners;
  const segments = analyzeWallSegments(activeCorners);
  const straightened = computeStraightenedBounds(activeCorners, config.straightenWallDistance || 5);

  // Original committed segments for comparison in preview
  const originalSegments = analyzeWallSegments(config.corners);

  // SVG viewport bounds calculation
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  [...config.corners, ...activeCorners, ...straightened.squaredCorners].forEach(c => {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  });

  // Calculate partition opening conflicts and sub-room divisions
  const partitionConflicts = checkPartitionOpeningConflicts(activeCorners, config.openings, config.partitionWalls);
  const subRooms = detectSubRooms(activeCorners, config.partitionWalls, config.openings);

  const padding = 85; // padding in cm for SVG
  const widthCm = Math.max(220, (maxX - minX) + padding * 2);
  const heightCm = Math.max(220, (maxY - minY) + padding * 2);

  // Transform coordinates to SVG space
  const toSvgX = (x: number) => x - minX + padding;
  const toSvgY = (y: number) => y - minY + padding;
  const fromSvgX = (sx: number) => sx - padding + minX;
  const fromSvgY = (sy: number) => sy - padding + minY;

  // Convert browser mouse event to SVG coordinate space
  const getSvgCoordinates = (e: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x: fromSvgX(svgP.x), y: fromSvgY(svgP.y) };
  };

  // Drag listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const coords = getSvgCoordinates(e);
      if (!coords) return;

      // Handle dragging opening along wall
      if (draggingOpeningId) {
        if (!onChange) return;
        const opIndex = config.openings.findIndex(o => o.id === draggingOpeningId);
        if (opIndex === -1) return;
        const op = config.openings[opIndex];
        const seg = segments[op.wallIndex];
        if (!seg) return;

        // Project mouse position onto wall segment
        const proj = projectPointOntoSegment(coords.x, coords.y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
        const maxOffset = Math.max(0, seg.length - op.width - 5);
        const clampedOffset = Math.max(5, Math.min(maxOffset, proj.distanceAlongCm));

        const updatedOpenings = [...config.openings];
        updatedOpenings[opIndex] = {
          ...op,
          distanceFromStart: Math.round(clampedOffset),
        };
        onChange({ ...config, openings: updatedOpenings });
      }

      // Handle dragging corner vertex (PROPOSED DRAFT - NOT LIVE COMMIT)
      if (draggingCornerIndex !== null) {
        const baseCorners = draftCorners || [...config.corners];
        const updatedCorners = [...baseCorners];
        updatedCorners[draggingCornerIndex] = {
          x: Math.round(coords.x),
          y: Math.round(coords.y),
        };

        setDraftCorners(updatedCorners);
        setPendingConfirmation(true);
      }
    };

    const handleMouseUp = () => {
      setDraggingOpeningId(null);
      setDraggingCornerIndex(null);
    };

    if (draggingOpeningId || draggingCornerIndex !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingOpeningId, draggingCornerIndex, config, draftCorners, segments, onChange]);

  // Handle draft wall length change in preview (creates draft preview for user confirmation)
  const handleDraftWallLengthChange = (wallIdx: number, newLengthCm: number) => {
    const baseCorners = draftCorners || [...config.corners];
    const res = updateWallLengthParametric(baseCorners, wallIdx, newLengthCm, config.shape);
    setDraftCorners(res.newCorners);
    setPendingConfirmation(true);
  };

  // Confirm proposed room dimensions
  const handleConfirmNewDimensions = () => {
    if (!onChange || !draftCorners) return;

    const isRect = checkIsRectangular(draftCorners);
    const newShape = isRect ? 'rectangular' : 'asymmetric';

    const cMinX = Math.min(...draftCorners.map(c => c.x));
    const cMaxX = Math.max(...draftCorners.map(c => c.x));
    const cMinY = Math.min(...draftCorners.map(c => c.y));
    const cMaxY = Math.max(...draftCorners.map(c => c.y));

    onChange({
      ...config,
      corners: draftCorners,
      shape: config.shape === 'l_shaped' ? 'l_shaped' : newShape,
      length: Math.round(cMaxX - cMinX),
      width: Math.round(cMaxY - cMinY),
    });

    setDraftCorners(null);
    setPendingConfirmation(false);
  };

  // Cancel / Revert proposed room dimensions
  const handleCancelNewDimensions = () => {
    setDraftCorners(null);
    setPendingConfirmation(false);
  };

  // Add opening to selected wall
  const addOpeningToSelectedWall = (type: 'door' | 'window') => {
    if (!onChange || selectedWallIndex === null) return;
    const seg = segments[selectedWallIndex];
    const width = type === 'door' ? 90 : 120;
    const newOp: Opening = {
      id: `op_${Date.now()}`,
      type,
      name: type === 'door' ? `Vrata ${config.openings.length + 1}` : `Prozor ${config.openings.length + 1}`,
      wallIndex: selectedWallIndex,
      distanceFromStart: Math.max(20, Math.round((seg.length - width) / 2)),
      width,
      height: type === 'door' ? 205 : 140,
      sillHeight: type === 'window' ? 90 : 0,
      useUAProfile: type === 'door',
    };
    setSelectedOpeningId(newOp.id);
    setPreviewEditorMode('opening');
    onChange({ ...config, openings: [...config.openings, newOp] });
  };

  // Delete opening
  const deleteOpening = (id: string) => {
    if (!onChange) return;
    onChange({ ...config, openings: config.openings.filter(o => o.id !== id) });
    if (selectedOpeningId === id) {
      setSelectedOpeningId(null);
      setPreviewEditorMode('wall');
    }
  };

  // Generate SVG polygon points string for original committed wall
  const origPolygonPoints = config.corners
    .map(c => `${toSvgX(c.x)},${toSvgY(c.y)}`)
    .join(' ');

  // Generate SVG polygon points string for proposed draft wall
  const draftPolygonPoints = activeCorners
    .map(c => `${toSvgX(c.x)},${toSvgY(c.y)}`)
    .join(' ');

  // Generate SVG polygon points string for straightened Knauf frame
  const squaredPolygonPoints = straightened.squaredCorners
    .map(c => `${toSvgX(c.x)},${toSvgY(c.y)}`)
    .join(' ');

  const selectedOpening = config.openings.find(o => o.id === selectedOpeningId);

  // Area & dimension metrics comparison
  const originalAreaM2 = (config.length * config.width) / 10000;
  const draftMinX = Math.min(...activeCorners.map(c => c.x));
  const draftMaxX = Math.max(...activeCorners.map(c => c.x));
  const draftMinY = Math.min(...activeCorners.map(c => c.y));
  const draftMaxY = Math.max(...activeCorners.map(c => c.y));
  const draftLenCm = Math.round(draftMaxX - draftMinX);
  const draftWidthCm = Math.round(draftMaxY - draftMinY);
  const draftAreaM2 = (draftLenCm * draftWidthCm) / 10000;
  const areaDiffM2 = draftAreaM2 - originalAreaM2;

  return (
    <div className="w-full bg-white rounded-lg border border-slate-300 shadow-2xs p-4 space-y-4">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-[#00529B] rounded border border-blue-200">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base uppercase tracking-tight flex items-center gap-2">
              <span>Interaktivni 2D Tlocrt i Kotiranje</span>
              <span className="text-[10px] px-2 py-0.5 bg-sky-100 text-[#00529B] rounded font-mono font-bold">CAD Preview</span>
            </h3>
            <p className="text-xs text-slate-500">
              Povlačite kuteve ili kliknite na zid/otvor za izravan unos mjera unutar preview prikaza uz potvrdu novih dimenzija
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-semibold">
            <input
              id="toggle_kote"
              type="checkbox"
              checked={showKote}
              onChange={(e) => setShowKote(e.target.checked)}
              className="rounded text-[#00529B] focus:ring-[#00529B]"
            />
            <span>Prikaz kota (mjera)</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-semibold">
            <input
              id="toggle_stud_labels"
              type="checkbox"
              checked={showStudLabels}
              onChange={(e) => setShowStudLabels(e.target.checked)}
              className="rounded text-[#00529B] focus:ring-[#00529B]"
            />
            <span>Raster CW {config.studSpacing}mm</span>
          </label>

          {config.shape === 'asymmetric' && (
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-semibold">
              <input
                id="toggle_clearance_gaps"
                type="checkbox"
                checked={showClearanceGaps}
                onChange={(e) => setShowClearanceGaps(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Izravnanje 90.0°</span>
            </label>
          )}
        </div>
      </div>      {/* Asymmetry Warning / Straightening info */}
      {config.shape === 'asymmetric' && straightened.deviationsDeg.some(d => d > 1.0) && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2 uppercase tracking-wide text-[11px]">
              <span>Asimetrična prostorija (Zidovi nisu pod 90.0°)</span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-950 font-mono rounded text-[10px]">
                Odstupanje do {Math.max(...straightened.deviationsDeg).toFixed(1)}°
              </span>
            </div>
            <p className="text-amber-800 text-[11px]">
              Zelena linija na tlocrtu prikazuje izravnati Knauf raster koji kompenzira krive zidove.
            </p>
          </div>
        </div>
      )}

      {/* 1. PROPOSED DIMENSIONS CONFIRMATION BANNER (DOCKED ABOVE CANVAS - NO OVERLAPPING!) */}
      {pendingConfirmation && draftCorners && (
        <div className="bg-slate-900 border-2 border-sky-400 text-white rounded-lg p-3 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-md border border-sky-500/40">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-sky-300 uppercase tracking-wide flex items-center gap-2">
                <span>Predložene nove dimenzije prostorije</span>
                <span className="px-2 py-0.5 bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] font-mono">
                  Čeka potvrdu
                </span>
              </div>
              <div className="text-xs text-slate-200 font-medium mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  Dimenzije: <strong>{(draftLenCm / 100).toFixed(2)} × {(draftWidthCm / 100).toFixed(2)} m</strong> 
                  <span className="text-slate-400 text-[11px] ml-1">
                    (bilo {(config.length / 100).toFixed(2)} × {(config.width / 100).toFixed(2)} m)
                  </span>
                </span>
                <span>
                  Površina: <strong>{draftAreaM2.toFixed(2)} m²</strong> 
                  <span className={areaDiffM2 >= 0 ? 'text-emerald-400 text-[11px] ml-1' : 'text-rose-400 text-[11px] ml-1'}>
                    ({areaDiffM2 >= 0 ? `+${areaDiffM2.toFixed(2)}` : areaDiffM2.toFixed(2)} m²)
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCancelNewDimensions}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
              <span>Poništi promjene</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmNewDimensions}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold shadow-md shadow-sky-900/40 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 text-sky-200" />
              <span>Potvrdi i preračunaj sobu</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= PARTITION OPENING CONFLICT WARNING BANNER ================= */}
      {partitionConflicts.length > 0 && (
        <div className="p-3 bg-amber-950/80 border-2 border-amber-500 rounded-lg text-amber-200 text-xs shadow-lg space-y-1.5 animate-pulse">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Upozorenje konstrukcije: Konflikt pregradnog zida i otvora!</span>
          </div>
          {partitionConflicts.map((conf, cIdx) => (
            <p key={cIdx} className="text-[11px] text-amber-100 pl-7 leading-relaxed">
              • {conf.message}
            </p>
          ))}
          <div className="pl-7 pt-1 text-[10px] text-amber-400 font-medium">
            💡 Savjet: Pomaknite poziciju pregrade u tabu "Pregrade" ili otvor u tabu "Otvori" tako da razmak od dovratnika bude barem 15 cm.
          </div>
        </div>
      )}

      {/* ================= BLUEPRINT PREVIEW CONTAINER (UNOBSTRUCTED VIEW) ================= */}
      <div className="relative w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-4 min-h-[480px]">
        {/* Architectural Grid Background */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#94a3b8 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />

        {/* ================= MAIN SVG CANVAS ================= */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${widthCm} ${heightCm}`}
          className="w-full h-auto max-h-[580px] select-none"
          style={{ overflow: 'visible', cursor: draggingOpeningId || draggingCornerIndex !== null ? 'grabbing' : 'default' }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid_cm" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#334155" strokeWidth="0.5" />
            </pattern>
            {/* Dimension arrow markers */}
            <marker id="dim_arrow_start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 10 2 L 2 5 L 10 8 z" fill="#38bdf8" />
            </marker>
            <marker id="dim_arrow_end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* 1. Original Committed Wall Shadow (if draft is active) */}
          {draftCorners && (
            <polygon
              points={origPolygonPoints}
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeDasharray="4,4"
              opacity="0.6"
            />
          )}

          {/* 2. Active Wall Polygon Fill */}
          <polygon
            points={draftPolygonPoints}
            fill="#0f172a"
            stroke={draftCorners ? '#38bdf8' : (config.shape === 'asymmetric' ? '#f43f5e' : '#475569')}
            strokeWidth={draftCorners ? '3.5' : (config.shape === 'asymmetric' ? '2.5' : '3.5')}
            strokeDasharray={!draftCorners && config.shape === 'asymmetric' && config.enableStraightening ? '6,4' : 'none'}
          />

          {/* 3. Straightened Squared Drywall Frame (Green if active) */}
          {config.shape === 'asymmetric' && (config.constructionMode === 'freestanding_lining' || config.enableStraightening) && (
            <g>
              {/* Inscribed Rectangle Polygon */}
              <polygon
                points={squaredPolygonPoints}
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />

              {/* 90° Right Angle Marks at all 4 corners of the inscribed frame */}
              {straightened.squaredCorners.map((sc, scIdx) => {
                const svX = toSvgX(sc.x);
                const svY = toSvgY(sc.y);
                const sSignX = scIdx === 0 || scIdx === 3 ? 1 : -1;
                const sSignY = scIdx === 0 || scIdx === 1 ? 1 : -1;
                const arm = 12;

                return (
                  <path
                    key={`right_angle_mark_${scIdx}`}
                    d={`M ${svX + sSignX * arm} ${svY} L ${svX + sSignX * arm} ${svY + sSignY * arm} L ${svX} ${svY + sSignY * arm}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* Inscribed 90° Frame Dimension Badges (Top & Right) */}
              {straightened.squaredCorners.length >= 4 && (
                <>
                  {/* Top Edge Length */}
                  <g transform={`translate(${(toSvgX(straightened.squaredCorners[0].x) + toSvgX(straightened.squaredCorners[1].x)) / 2}, ${toSvgY(straightened.squaredCorners[0].y) + 14})`}>
                    <rect x="-42" y="-9" width="84" height="18" rx="4" fill="#064e3b" stroke="#10b981" strokeWidth="1" />
                    <text y="3.5" textAnchor="middle" fill="#a7f3d0" fontSize="9" fontWeight="bold" fontFamily="monospace">
                      {(straightened.inscribedLengthCm / 100).toFixed(2)}m (90.0°)
                    </text>
                  </g>

                  {/* Right Edge Width */}
                  <g transform={`translate(${toSvgX(straightened.squaredCorners[1].x) - 14}, ${(toSvgY(straightened.squaredCorners[1].y) + toSvgY(straightened.squaredCorners[2].y)) / 2})`}>
                    <rect x="-42" y="-9" width="84" height="18" rx="4" fill="#064e3b" stroke="#10b981" strokeWidth="1" transform="rotate(90)" />
                    <text y="3.5" textAnchor="middle" fill="#a7f3d0" fontSize="9" fontWeight="bold" fontFamily="monospace" transform="rotate(90)">
                      {(straightened.inscribedWidthCm / 100).toFixed(2)}m (90.0°)
                    </text>
                  </g>
                </>
              )}

              {/* Clearance Gap Lines and Labels to Crooked Walls */}
              {showClearanceGaps && straightened.wallClearances.map((wc, wIdx) => {
                const origSeg = originalSegments[wIdx];
                if (!origSeg) return null;
                const mX = (origSeg.p1.x + origSeg.p2.x) / 2;
                const mY = (origSeg.p1.y + origSeg.p2.y) / 2;
                
                // Find closest point on inscribed frame
                const frameEdges = [
                  { p1: straightened.squaredCorners[0], p2: straightened.squaredCorners[1] },
                  { p1: straightened.squaredCorners[1], p2: straightened.squaredCorners[2] },
                  { p1: straightened.squaredCorners[2], p2: straightened.squaredCorners[3] },
                  { p1: straightened.squaredCorners[3], p2: straightened.squaredCorners[0] },
                ];

                let closestPt = { x: mX, y: mY };
                let minD = Infinity;
                frameEdges.forEach(fe => {
                  const proj = projectPointOntoSegment(mX, mY, fe.p1.x, fe.p1.y, fe.p2.x, fe.p2.y);
                  const d = Math.hypot(mX - proj.projX, mY - proj.projY);
                  if (d < minD) {
                    minD = d;
                    closestPt = { x: proj.projX, y: proj.projY };
                  }
                });

                const sx1 = toSvgX(mX);
                const sy1 = toSvgY(mY);
                const sx2 = toSvgX(closestPt.x);
                const sy2 = toSvgY(closestPt.y);

                return (
                  <g key={`clearance_line_${wIdx}`}>
                    <line
                      x1={sx1}
                      y1={sy1}
                      x2={sx2}
                      y2={sy2}
                      stroke="#f59e0b"
                      strokeWidth="1.2"
                      strokeDasharray="2,2"
                    />
                    <g transform={`translate(${(sx1 + sx2) / 2}, ${(sy1 + sy2) / 2})`}>
                      <rect x="-24" y="-7" width="48" height="14" rx="3" fill="#78350f" stroke="#f59e0b" strokeWidth="0.8" />
                      <text y="3" textAnchor="middle" fill="#fef3c7" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
                        {wc.minClearanceCm}-{wc.maxClearanceCm}cm
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* 4. Render Wall Segments, Studs, Dimensions & Openings */}
          {segments.map((seg, idx) => {
            const p1 = seg.p1;
            const p2 = seg.p2;
            const sx1 = toSvgX(p1.x);
            const sy1 = toSvgY(p1.y);
            const sx2 = toSvgX(p2.x);
            const sy2 = toSvgY(p2.y);

            const isSelectedWall = selectedWallIndex === idx;

            const midX = (sx1 + sx2) / 2;
            const midY = (sy1 + sy2) / 2;

            // Normal vector for placing dimension text outside the wall
            const dx = sx2 - sx1;
            const dy = sy2 - sy1;
            const len = Math.hypot(dx, dy);
            if (len === 0) return null;
            const nx = -dy / len;
            const ny = dx / len;

            const textDist = 32;
            const labelX = midX + nx * textDist;
            const labelY = midY + ny * textDist;

            // Calculate studs on this wall (opening-aware!)
            const wallOpenings = config.openings.filter(o => o.wallIndex === idx);
            const studs = calculateStudLocations(seg.length, config.studSpacing, wallOpenings);

            // Compute clean interior position for angle badge using bisector
            const numCorners = activeCorners.length;
            const prevIdx = (idx - 1 + numCorners) % numCorners;
            const nextIdx = (idx + 1) % numCorners;
            const anglePosCm = getInteriorCornerBisector(
              activeCorners[prevIdx],
              activeCorners[idx],
              activeCorners[nextIdx],
              36 // 36 cm offset into room interior
            );
            const angleBadgeSvgX = toSvgX(anglePosCm.x);
            const angleBadgeSvgY = toSvgY(anglePosCm.y);

            return (
              <g key={`wall_seg_${idx}`}>
                {/* Wall Active Selection Highlight Beam */}
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke={isSelectedWall ? '#38bdf8' : 'transparent'}
                  strokeWidth="14"
                  strokeOpacity={isSelectedWall ? 0.4 : 0}
                  strokeLinecap="round"
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedWallIndex(idx);
                    setSelectedOpeningId(null);
                    setPreviewEditorMode('wall');
                  }}
                />

                {/* Main Wall Line */}
                <line
                  x1={sx1}
                  y1={sy1}
                  x2={sx2}
                  y2={sy2}
                  stroke={isSelectedWall ? '#0284c7' : '#64748b'}
                  strokeWidth="4"
                  className="cursor-pointer hover:stroke-sky-400 transition-colors"
                  onClick={() => {
                    setSelectedWallIndex(idx);
                    setSelectedOpeningId(null);
                    setPreviewEditorMode('wall');
                  }}
                />

                {/* Interactive Wall Length Label Button */}
                <g 
                  onClick={() => {
                    setSelectedWallIndex(idx);
                    setSelectedOpeningId(null);
                    setPreviewEditorMode('wall');
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x={labelX - 44}
                    y={labelY - 12}
                    width="88"
                    height="24"
                    rx="5"
                    fill={isSelectedWall ? '#0284c7' : '#1e293b'}
                    stroke={isSelectedWall ? '#38bdf8' : '#475569'}
                    strokeWidth={isSelectedWall ? '2' : '1'}
                    className="transition-colors hover:fill-sky-800"
                  />
                  <text
                    x={labelX}
                    y={labelY + 4}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {seg.name}: {(seg.length / 100).toFixed(2)}m
                  </text>
                </g>

                {/* Internal Corner Angle Badge (Clean interior placement - NO vertex overlap!) */}
                <g transform={`translate(${angleBadgeSvgX}, ${angleBadgeSvgY})`}>
                  <circle
                    r="12.5"
                    fill={seg.isCrooked ? '#881337' : '#064e3b'}
                    stroke={seg.isCrooked ? '#f43f5e' : '#10b981'}
                    strokeWidth="1.5"
                  />
                  <text
                    y="3.5"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {seg.internalCornerAngle.toFixed(0)}°
                  </text>
                </g>

                {/* Render Individual Studs along the wall */}
                {studs.map((st, sIdx) => {
                  const t = st.offsetCm / seg.length;
                  const studX = sx1 + dx * t;
                  const studY = sy1 + dy * t;

                  const isUA = st.type === 'door_jamb_ua';
                  const isCorner = st.type === 'corner';
                  const isJamb = st.type.includes('jamb');

                  // Normal direction tick for stud cross-section
                  const tickLen = isUA ? 10 : 7;
                  const tx1 = studX - nx * tickLen;
                  const ty1 = studY - ny * tickLen;
                  const tx2 = studX + nx * tickLen;
                  const ty2 = studY + ny * tickLen;

                  return (
                    <g key={`stud_${idx}_${sIdx}`}>
                      {/* Stud Mark line */}
                      <line
                        x1={tx1}
                        y1={ty1}
                        x2={tx2}
                        y2={ty2}
                        stroke={isUA ? '#3b82f6' : isCorner ? '#c084fc' : isJamb ? '#f59e0b' : '#38bdf8'}
                        strokeWidth={isUA ? '3.5' : '2'}
                      />

                      {/* Small Stud Indicator */}
                      <circle
                        cx={studX}
                        cy={studY}
                        r={isUA ? 4 : 2.5}
                        fill={isUA ? '#2563eb' : isJamb ? '#d97706' : '#94a3b8'}
                      />

                      {/* Stud offset label */}
                      {showStudLabels && !isCorner && sIdx % 2 === 0 && (
                        <text
                          x={studX - nx * 15}
                          y={studY - ny * 15 + 3}
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="7.5"
                          fontFamily="monospace"
                        >
                          {Math.round(st.offsetCm)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Render Openings (Doors & Windows) with interactive Drag & Kote */}
                {wallOpenings.map((op, oIdx) => {
                  const tStart = op.distanceFromStart / seg.length;
                  const tEnd = (op.distanceFromStart + op.width) / seg.length;

                  const ox1 = sx1 + dx * tStart;
                  const oy1 = sy1 + dy * tStart;
                  const ox2 = sx1 + dx * tEnd;
                  const oy2 = sy1 + dy * tEnd;

                  const isDoor = op.type === 'door';
                  const isOpeningSelected = selectedOpeningId === op.id;

                  // Distances for Kote
                  const kotaLeftCm = Math.round(op.distanceFromStart);
                  const kotaWidthCm = Math.round(op.width);
                  const kotaRightCm = Math.round(Math.max(0, seg.length - (op.distanceFromStart + op.width)));

                  // Offset for dimension lines
                  const kOffset = 18;
                  const kx1 = sx1 + nx * kOffset;
                  const ky1 = sy1 + ny * kOffset;
                  const kox1 = ox1 + nx * kOffset;
                  const koy1 = oy1 + ny * kOffset;
                  const kox2 = ox2 + nx * kOffset;
                  const koy2 = oy2 + ny * kOffset;
                  const kx2 = sx2 + nx * kOffset;
                  const ky2 = sy2 + ny * kOffset;

                  return (
                    <g key={`opening_${op.id}`}>
                      {/* Opening cut-out background line (erases wall line) */}
                      <line
                        x1={ox1}
                        y1={oy1}
                        x2={ox2}
                        y2={oy2}
                        stroke="#020617"
                        strokeWidth="8"
                      />

                      {/* Opening Line / Opening Box */}
                      <line
                        x1={ox1}
                        y1={oy1}
                        x2={ox2}
                        y2={oy2}
                        stroke={isOpeningSelected ? '#38bdf8' : isDoor ? '#0284c7' : '#d97706'}
                        strokeWidth={isOpeningSelected ? '4' : '3'}
                        strokeDasharray={isDoor ? 'none' : '4,2'}
                      />

                      {/* Door swing arc if door */}
                      {isDoor && (
                        <path
                          d={`M ${ox1} ${oy1} A ${op.width * 0.7} ${op.width * 0.7} 0 0 1 ${ox1 - nx * op.width * 0.55} ${oy1 - ny * op.width * 0.55}`}
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth="1.2"
                          strokeDasharray="3,3"
                        />
                      )}

                      {/* Interactive Drag Handle & Badge */}
                      <g 
                        transform={`translate(${(ox1 + ox2) / 2}, ${(oy1 + oy2) / 2})`}
                        className="cursor-move"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setSelectedOpeningId(op.id);
                          setSelectedWallIndex(idx);
                          setPreviewEditorMode('opening');
                          setDraggingOpeningId(op.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOpeningId(op.id);
                          setSelectedWallIndex(idx);
                          setPreviewEditorMode('opening');
                        }}
                      >
                        <rect
                          x="-34"
                          y="-10"
                          width="68"
                          height="20"
                          rx="4"
                          fill={isOpeningSelected ? '#0284c7' : isDoor ? '#0369a1' : '#b45309'}
                          stroke={isOpeningSelected ? '#ffffff' : '#94a3b8'}
                          strokeWidth="1.5"
                        />
                        <text
                          y="4"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="8.5"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {isDoor ? `Vrata ${op.width}` : `Prozor ${op.width}`}
                        </text>
                      </g>

                      {/* Real-time CAD Leader Lines & Kote (mjere od rubova) */}
                      {showKote && (
                        <g opacity={isOpeningSelected ? 1 : 0.85}>
                          {/* Kota 1: Start to Opening Left */}
                          <line x1={kx1} y1={ky1} x2={kox1} y2={koy1} stroke="#38bdf8" strokeWidth="1" />
                          <line x1={sx1} y1={sy1} x2={kx1 + nx * 4} y2={ky1 + ny * 4} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2,2" />
                          <line x1={ox1} y1={oy1} x2={kox1 + nx * 4} y2={koy1 + ny * 4} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2,2" />
                          <text
                            x={(kx1 + kox1) / 2}
                            y={(ky1 + koy1) / 2 - 3}
                            textAnchor="middle"
                            fill="#38bdf8"
                            fontSize="8"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {kotaLeftCm} cm
                          </text>

                          {/* Kota 2: Opening Width */}
                          <line x1={kox1} y1={koy1} x2={kox2} y2={koy2} stroke="#f59e0b" strokeWidth="1.2" />
                          <line x1={ox2} y1={oy2} x2={kox2 + nx * 4} y2={koy2 + ny * 4} stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="2,2" />
                          <text
                            x={(kox1 + kox2) / 2}
                            y={(koy1 + koy2) / 2 - 3}
                            textAnchor="middle"
                            fill="#fbbf24"
                            fontSize="8.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {kotaWidthCm} cm
                          </text>

                          {/* Kota 3: Opening Right to End Corner */}
                          <line x1={kox2} y1={koy2} x2={kx2} y2={ky2} stroke="#38bdf8" strokeWidth="1" />
                          <line x1={sx2} y1={sy2} x2={kx2 + nx * 4} y2={ky2 + ny * 4} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2,2" />
                          <text
                            x={(kox2 + kx2) / 2}
                            y={(koy2 + ky2) / 2 - 3}
                            textAnchor="middle"
                            fill="#38bdf8"
                            fontSize="8"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {kotaRightCm} cm
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* 5. Render Sub-Rooms Zones and Labels */}
          {subRooms.length > 1 && subRooms.map((sr, srIdx) => {
            const srPts = sr.corners.map(c => `${toSvgX(c.x)},${toSvgY(c.y)}`).join(' ');
            const scX = toSvgX(sr.centroid.x);
            const scY = toSvgY(sr.centroid.y);

            return (
              <g key={`subroom_${sr.id}`}>
                <polygon
                  points={srPts}
                  fill={srIdx === 0 ? '#38bdf8' : '#a855f7'}
                  fillOpacity="0.04"
                  stroke={srIdx === 0 ? '#0284c7' : '#9333ea'}
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
                <g transform={`translate(${scX}, ${scY})`}>
                  <rect
                    x="-46"
                    y="-15"
                    width="92"
                    height="30"
                    rx="6"
                    fill="#0f172a"
                    stroke={srIdx === 0 ? '#38bdf8' : '#c084fc'}
                    strokeWidth="1"
                    opacity="0.92"
                  />
                  <text
                    y="-2"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    {sr.name}
                  </text>
                  <text
                    y="9"
                    textAnchor="middle"
                    fill={srIdx === 0 ? '#38bdf8' : '#e879f9'}
                    fontSize="8.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {sr.areaM2.toFixed(2)} m²
                  </text>
                </g>
              </g>
            );
          })}

          {/* 6. Render Internal Partition Walls (W111 / W112 with Studs & Doors) */}
          {config.partitionWalls.map((p, pIdx) => {
            const px1 = toSvgX(p.startX);
            const py1 = toSvgY(p.startY);
            const px2 = toSvgX(p.endX);
            const py2 = toSvgY(p.endY);
            const pDx = px2 - px1;
            const pDy = py2 - py1;
            const pLenSvg = Math.hypot(pDx, pDy);
            if (pLenSvg === 0) return null;

            const pLenCm = Math.hypot(p.endX - p.startX, p.endY - p.startY);
            const pLenM = (pLenCm / 100).toFixed(2);

            const pNx = -pDy / pLenSvg;
            const pNy = pDx / pLenSvg;
            const pUx = pDx / pLenSvg;
            const pUy = pDy / pLenSvg;

            // Partition thickness in cm: profile depth + 2 * (layers * 1.25cm)
            const profDepthCm = p.profileType === 'CW_100' ? 10 : p.profileType === 'CW_75' ? 7.5 : 5;
            const layers = p.layers || config.boardLayers || 1;
            const totalThickCm = profDepthCm + 2 * (layers * 1.25);
            const halfThick = totalThickCm / 2;

            // Compute studs along partition wall
            const pStudLocs = calculateStudLocations(pLenCm, config.studSpacing, p.openings || []);

            return (
              <g key={`partition_${p.id}`}>
                {/* Partition Wall Core Body (Drywall outlines) */}
                <line
                  x1={px1 + pNx * halfThick}
                  y1={py1 + pNy * halfThick}
                  x2={px2 + pNx * halfThick}
                  y2={py2 + pNy * halfThick}
                  stroke="#c084fc"
                  strokeWidth="1.5"
                />
                <line
                  x1={px1 - pNx * halfThick}
                  y1={py1 - pNy * halfThick}
                  x2={px2 - pNx * halfThick}
                  y2={py2 - pNy * halfThick}
                  stroke="#c084fc"
                  strokeWidth="1.5"
                />

                {/* Partition Wall Interior Fill */}
                <polygon
                  points={`
                    ${px1 + pNx * halfThick},${py1 + pNy * halfThick}
                    ${px2 + pNx * halfThick},${py2 + pNy * halfThick}
                    ${px2 - pNx * halfThick},${py2 - pNy * halfThick}
                    ${px1 - pNx * halfThick},${py1 - pNy * halfThick}
                  `}
                  fill="#7e22ce"
                  fillOpacity="0.25"
                />

                {/* Internal Studs on Partition Wall */}
                {pStudLocs.map((stud, sIdx) => {
                  const sPosSvg = (stud.offsetCm / pLenCm) * pLenSvg;
                  const stX = px1 + pUx * sPosSvg;
                  const stY = py1 + pUy * sPosSvg;
                  const isUA = stud.type === 'door_jamb_ua';

                  return (
                    <line
                      key={`pstud_${sIdx}`}
                      x1={stX + pNx * (halfThick - 0.5)}
                      y1={stY + pNy * (halfThick - 0.5)}
                      x2={stX - pNx * (halfThick - 0.5)}
                      y2={stY - pNy * (halfThick - 0.5)}
                      stroke={isUA ? '#f59e0b' : '#e9d5ff'}
                      strokeWidth={isUA ? '2.5' : '1.2'}
                    />
                  );
                })}

                {/* Doors in Partition Wall */}
                {(p.openings || []).map((pOp, opIdx) => {
                  const opStartSvg = (pOp.distanceFromStart / pLenCm) * pLenSvg;
                  const opWidthSvg = (pOp.width / pLenCm) * pLenSvg;

                  const dop1X = px1 + pUx * opStartSvg;
                  const dop1Y = py1 + pUy * opStartSvg;
                  const dop2X = px1 + pUx * (opStartSvg + opWidthSvg);
                  const dop2Y = py1 + pUy * (opStartSvg + opWidthSvg);

                  // Door leaf open at 90 degrees
                  const leafEndX = dop1X + pNx * opWidthSvg;
                  const leafEndY = dop1Y + pNy * opWidthSvg;

                  return (
                    <g key={`part_op_${opIdx}`}>
                      {/* Clear opening cut */}
                      <line
                        x1={dop1X}
                        y1={dop1Y}
                        x2={dop2X}
                        y2={dop2Y}
                        stroke="#0f172a"
                        strokeWidth={totalThickCm + 2}
                      />
                      {/* Door leaf line */}
                      <line
                        x1={dop1X}
                        y1={dop1Y}
                        x2={leafEndX}
                        y2={leafEndY}
                        stroke="#38bdf8"
                        strokeWidth="2"
                      />
                      {/* Door swing arc */}
                      <path
                        d={`M ${leafEndX} ${leafEndY} A ${opWidthSvg} ${opWidthSvg} 0 0 0 ${dop2X} ${dop2Y}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      {/* Door label */}
                      <text
                        x={(dop1X + dop2X) / 2}
                        y={(dop1Y + dop2Y) / 2 - 6}
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize="7.5"
                        fontWeight="bold"
                      >
                        {pOp.name} ({pOp.width}cm)
                      </text>
                    </g>
                  );
                })}

                {/* Partition Label Badge */}
                <g transform={`translate(${(px1 + px2) / 2 + pNx * 16}, ${(py1 + py2) / 2 + pNy * 16})`}>
                  <rect
                    x="-42"
                    y="-9"
                    width="84"
                    height="18"
                    rx="4"
                    fill="#581c87"
                    stroke="#c084fc"
                    strokeWidth="1"
                  />
                  <text
                    y="3.5"
                    textAnchor="middle"
                    fill="#f3e8ff"
                    fontSize="8.5"
                    fontWeight="bold"
                  >
                    {p.name || `Pregrada ${pIdx + 1}`}: {pLenM}m
                  </text>
                </g>
              </g>
            );
          })}

          {/* 7. Partition-Opening Conflict Markers on 2D Plan */}
          {partitionConflicts.map((conf, cIdx) => {
            const confSvgX = toSvgX(conf.conflictPoint.x);
            const confSvgY = toSvgY(conf.conflictPoint.y);

            return (
              <g key={`conflict_marker_${cIdx}`}>
                <circle
                  cx={confSvgX}
                  cy={confSvgY}
                  r="14"
                  fill="#ef4444"
                  fillOpacity="0.25"
                  className="animate-ping"
                />
                <circle
                  cx={confSvgX}
                  cy={confSvgY}
                  r="9"
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={confSvgX}
                  y={confSvgY + 3}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="bold"
                >
                  !
                </text>
              </g>
            );
          })}

          {/* 8. Stable, High-Precision Corner Drag Handles (No jitter!) */}
          {activeCorners.map((c, cIdx) => {
            const cx = toSvgX(c.x);
            const cy = toSvgY(c.y);
            const isDraggingThis = draggingCornerIndex === cIdx;

            return (
              <g 
                key={`corner_handle_${cIdx}`}
                className="cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingCornerIndex(cIdx);
                }}
              >
                {/* Large invisible hit area */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="20"
                  fill="transparent"
                />
                {/* Outer Ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isDraggingThis ? 9.5 : 7.5}
                  fill={isDraggingThis ? '#0284c7' : '#00529B'}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                {/* Center Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="2.5"
                  fill="#38bdf8"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Blueprint Scale & Legend */}
        <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 text-[10px] text-slate-300 space-y-1">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            Legenda 2D Tlocrta:
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-sky-400"></span>CW Vertikale</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-blue-500"></span>UA Ojačanje</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-amber-500"></span>Otvori (kote)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-purple-500"></span>Pregrada</span>
          </div>
        </div>
      </div>

      {/* ================= DOCKED WALL & OPENING QUICK CONTROL PANEL (BELOW CANVAS) ================= */}
      <div className="bg-slate-900 text-white rounded-lg p-3.5 border border-slate-800 shadow-sm space-y-3">
        {/* Navigation & Selection Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {segments.map((seg, sIdx) => {
              const isSelected = previewEditorMode === 'wall' && selectedWallIndex === sIdx;
              return (
                <button
                  key={`tab_wall_${sIdx}`}
                  type="button"
                  onClick={() => {
                    setSelectedWallIndex(sIdx);
                    setPreviewEditorMode('wall');
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  <span>{seg.name}: {(seg.length / 100).toFixed(2)}m</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPreviewEditorMode('opening')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              previewEditorMode === 'opening'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
            }`}
          >
            <DoorClosed className="w-3.5 h-3.5" />
            <span>Otvori ({config.openings.length})</span>
          </button>
        </div>

        {/* WALL EDITING FORM */}
        {previewEditorMode === 'wall' && selectedWallIndex !== null && segments[selectedWallIndex] && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-400"></span>
                <h4 className="text-sm font-bold text-sky-300">
                  Uređivanje: {segments[selectedWallIndex].name}
                </h4>
                <span className="text-xs text-slate-400">
                  ({(segments[selectedWallIndex].length / 100).toFixed(2)} m)
                </span>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span>Kut prema susjednom zidu:</span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                  segments[selectedWallIndex].isCrooked 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {segments[selectedWallIndex].internalCornerAngle.toFixed(1)}°
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-950/80 p-3 rounded-lg border border-slate-800">
              {/* Length adjustment */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                  Točna duljina zida (cm):
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <NumericInput
                      dark={true}
                      min={80}
                      max={3000}
                      step={10}
                      unit="cm"
                      value={Math.round(segments[selectedWallIndex].length)}
                      onChange={(newLen) => handleDraftWallLengthChange(selectedWallIndex, newLen)}
                      inputClassName="bg-slate-900 text-white border-slate-700 focus:border-sky-400 text-sm font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Smanji za 10 cm"
                      onClick={() => handleDraftWallLengthChange(selectedWallIndex, Math.max(80, Math.round(segments[selectedWallIndex].length) - 10))}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono font-bold border border-slate-700 transition-colors cursor-pointer"
                    >
                      -10 cm
                    </button>
                    <button
                      type="button"
                      title="Povećaj za 10 cm"
                      onClick={() => handleDraftWallLengthChange(selectedWallIndex, Math.min(3000, Math.round(segments[selectedWallIndex].length) + 10))}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono font-bold border border-slate-700 transition-colors cursor-pointer"
                    >
                      +10 cm
                    </button>
                  </div>
                </div>
              </div>

              {/* Add openings to this wall */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                  Dodaj otvore na {segments[selectedWallIndex].name}:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addOpeningToSelectedWall('door')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sky-900/80 hover:bg-sky-800 text-sky-200 border border-sky-600/60 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-sky-300" />
                    <span>Dodaj Vrata</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addOpeningToSelectedWall('window')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-600/60 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-300" />
                    <span>Dodaj Prozor</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OPENINGS EDITING FORM */}
        {previewEditorMode === 'opening' && (
          <div className="space-y-3 animate-fadeIn">
            {/* Openings Picker Pills */}
            {config.openings.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {config.openings.map((op, oIdx) => {
                  const isSel = selectedOpeningId === op.id;
                  const isDoor = op.type === 'door';
                  return (
                    <button
                      key={`pill_op_${op.id}`}
                      type="button"
                      onClick={() => setSelectedOpeningId(op.id)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSel
                          ? isDoor ? 'bg-sky-600 text-white border-sky-400' : 'bg-amber-600 text-white border-amber-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      <DoorClosed className="w-3 h-3" />
                      <span>{op.name} (Zid {op.wallIndex + 1})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedOpening ? (
              <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <DoorClosed className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-amber-300">
                      Uređivanje: {selectedOpening.name}
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">
                      (Nalazi se na Zidu {selectedOpening.wallIndex + 1})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteOpening(selectedOpening.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Obriši otvor</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                      Širina (cm):
                    </label>
                    <NumericInput
                      dark={true}
                      min={40}
                      max={400}
                      value={selectedOpening.width}
                      onChange={(w) => {
                        if (!onChange) return;
                        const updated = config.openings.map(o => o.id === selectedOpening.id ? { ...o, width: w } : o);
                        onChange({ ...config, openings: updated });
                      }}
                      inputClassName="bg-slate-900 text-white border-slate-700 focus:border-amber-400 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                      Visina (cm):
                    </label>
                    <NumericInput
                      dark={true}
                      min={40}
                      max={350}
                      value={selectedOpening.height}
                      onChange={(h) => {
                        if (!onChange) return;
                        const updated = config.openings.map(o => o.id === selectedOpening.id ? { ...o, height: h } : o);
                        onChange({ ...config, openings: updated });
                      }}
                      inputClassName="bg-slate-900 text-white border-slate-700 focus:border-amber-400 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                      Udaljenost od kuta (cm):
                    </label>
                    <NumericInput
                      dark={true}
                      min={0}
                      max={3000}
                      value={selectedOpening.distanceFromStart}
                      onChange={(d) => {
                        if (!onChange) return;
                        const updated = config.openings.map(o => o.id === selectedOpening.id ? { ...o, distanceFromStart: d } : o);
                        onChange({ ...config, openings: updated });
                      }}
                      inputClassName="bg-slate-900 text-white border-slate-700 focus:border-amber-400 text-xs font-mono font-bold"
                    />
                  </div>

                  {selectedOpening.type === 'window' ? (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                        Parapet (cm):
                      </label>
                      <NumericInput
                        dark={true}
                        min={0}
                        max={200}
                        value={selectedOpening.sillHeight || 90}
                        onChange={(sh) => {
                          if (!onChange) return;
                          const updated = config.openings.map(o => o.id === selectedOpening.id ? { ...o, sillHeight: sh } : o);
                          onChange({ ...config, openings: updated });
                        }}
                        inputClassName="bg-slate-900 text-white border-slate-700 focus:border-amber-400 text-xs font-mono font-bold"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedOpening.useUAProfile}
                          onChange={(e) => {
                            if (!onChange) return;
                            const updated = config.openings.map(o => o.id === selectedOpening.id ? { ...o, useUAProfile: e.target.checked } : o);
                            onChange({ ...config, openings: updated });
                          }}
                          className="h-4 w-4 rounded text-sky-500 focus:ring-sky-500 bg-slate-900 border-slate-700"
                        />
                        <span className="text-xs font-bold text-sky-300">UA ojačani profili (špaleta)</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
                <p className="text-slate-400 text-xs">
                  {config.openings.length === 0 
                    ? 'Nema dodanih otvora. Kliknite na gumbe ispod za dodavanje vrata ili prozora.' 
                    : 'Kliknite na otvor na tlocrtu ili odaberite karticu iznad za uređivanje dimenzija.'}
                </p>
                <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
                  <button
                    type="button"
                    onClick={() => addOpeningToSelectedWall('door')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sky-900/80 hover:bg-sky-800 text-sky-200 border border-sky-700/80 rounded text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Dodaj Vrata</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addOpeningToSelectedWall('window')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-700/80 rounded text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Dodaj Prozor</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
