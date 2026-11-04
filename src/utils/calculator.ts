import { 
  RoomConfig, 
  CalculatedSummary, 
  MaterialItem, 
  Opening,
  BoardSurfaceBreakdown,
  BoardCalculationDetails,
  InsulationSurfaceBreakdown,
  InsulationCalculationDetails
} from '../types';
import { analyzeWallSegments, computeStraightenedBounds, calculateStudLocations } from './geometry';

// Current realistic market prices in EUR (Balkans / EU reference)
export const DEFAULT_UNIT_PRICES: Record<string, number> = {
  // Profili
  'cw50_3m': 5.80,
  'cw75_3m': 6.90,
  'cw100_3m': 8.20,
  'uw50_3m': 4.90,
  'uw75_3m': 5.90,
  'uw100_3m': 7.10,
  'cd60_3m': 4.20,
  'ud28_3m': 3.10,
  'ua75_3m': 24.50,
  'ua_bracket_set': 14.50,

  // Nosači i spojnice
  'direct_hanger_120': 0.42,
  'cd_cross_connector': 0.55,
  'cd_extension_connector': 0.48,
  'acoustic_tape_30m': 8.90,
  'flexible_corner_tape_30m': 14.50, // Knauf Dallas / fleksibilni profil za kose kuteve

  // Vijci i pričvršćenja
  'screws_tn25_1000': 11.50,
  'screws_tn35_1000': 14.20,
  'screws_ln_screw_1000': 12.80,
  'impact_anchors_6x40_100': 7.50,

  // Ploče (cijena po ploči 2000x1250 = 2.5m²)
  'board_std_white': 8.90, // ~3.56 €/m²
  'board_moisture_green': 12.80, // ~5.12 €/m²
  'board_fire_red': 13.90, // ~5.56 €/m²
  'board_acoustic_blue': 18.50, // ~7.40 €/m²

  // Izolacija (rola/paket cca 10m²)
  'mineral_wool_50_pkg': 28.50,
  'mineral_wool_75_pkg': 38.00,
  'mineral_wool_100_pkg': 46.00,

  // Obrada spojeva
  'uniflott_5kg': 12.90,
  'joint_tape_90m': 6.50,
  'finish_putty_20kg': 19.50,
};

export function calculateDrywallBOM(
  config: RoomConfig,
  customPrices: Record<string, number> = {}
): CalculatedSummary {
  const prices = { ...DEFAULT_UNIT_PRICES, ...customPrices };
  const recommendations: string[] = [];

  // 1. Analyze room wall geometry
  const origSegments = analyzeWallSegments(config.corners);
  const wallHeightM = config.height / 100;

  // Asymmetry & Maximum Inscribed Straightening check
  const straightened = computeStraightenedBounds(config.corners, config.straightenWallDistance || 5);
  const maxDevDeg = Math.max(...straightened.deviationsDeg, 0);
  const isAsymmetrical = maxDevDeg > 1.5;

  // Determine whether to use inscribed 90° frame (freestanding) or crooked room walls (direct)
  const useInscribedFrame = isAsymmetrical 
    ? (config.constructionMode === 'freestanding_lining' || config.enableStraightening)
    : config.enableStraightening;

  const activeCorners = useInscribedFrame ? straightened.squaredCorners : config.corners;
  const segments = analyzeWallSegments(activeCorners);
  const totalPerimeter = segments.reduce((sum, s) => sum + s.length, 0) / 100; // in meters

  // Count crooked corners if direct lining is used
  const crookedCornersCount = origSegments.filter(s => s.isCrooked).length;

  if (isAsymmetrical) {
    if (config.constructionMode === 'wall_lining_direct') {
      recommendations.push(
        `⚠️ Zidna obloga na direktnim CD nosačima prati kosinu postojećih zidova (kutovi ostaju kosi do ${maxDevDeg.toFixed(1)}°). Za obradu spojeva ploča na nestandardnim kutevima predviđena je Knauf Dallas fleksibilna kutna traka (HRN EN 14353). Za postizanje pravog kuta 90.0° preporučuje se Samostojeći predzid W625.`
      );
    } else {
      recommendations.push(
        `✓ Samostojeći predzid W625 konstruira maksimalni upisani pravokutnik unutar prostorije pod točno 90.0° (dimenzije ${(straightened.inscribedLengthCm / 100).toFixed(2)}m × ${(straightened.inscribedWidthCm / 100).toFixed(2)}m, tlocrtni zazor varira od 5.0 do ${Math.max(...origSegments.map(s => s.clearanceMaxCm)).toFixed(1)} cm bez prelaska gabarita prostorije).`
      );
    }
  }

  // 2. Areas calculation
  let totalWallAreaGross = 0;
  segments.forEach(seg => {
    totalWallAreaGross += (seg.length / 100) * wallHeightM;
  });

  // Calculate outer openings area (doors and windows)
  let totalOpeningsArea = 0;
  let uaDoorsCount = 0;
  config.openings.forEach(op => {
    totalOpeningsArea += (op.width / 100) * (op.height / 100);
    if (op.type === 'door' && op.useUAProfile) {
      uaDoorsCount++;
    }
  });

  // Partition walls
  let totalPartitionsLengthM = 0;
  let partitionAreaGross = 0;
  let partitionOpeningsArea = 0;

  config.partitionWalls.forEach(p => {
    const lenM = Math.hypot(p.endX - p.startX, p.endY - p.startY) / 100;
    const hM = (p.height || config.height) / 100;
    totalPartitionsLengthM += lenM;
    // Partition walls are cladded on BOTH sides!
    partitionAreaGross += lenM * hM * 2;

    p.openings?.forEach(op => {
      partitionOpeningsArea += (op.width / 100) * (op.height / 100) * 2;
      if (op.type === 'door' && op.useUAProfile) {
        uaDoorsCount++;
      }
    });
  });

  // Ceiling Area
  const totalCeilingArea = config.ceilingMode !== 'none' ? straightened.areaOriginalM2 : 0;

  // Net cladding area
  let outerWallsCladdingArea = 0;
  if (config.constructionMode !== 'partition_only') {
    outerWallsCladdingArea = Math.max(0, totalWallAreaGross - totalOpeningsArea);
  }

  const partitionsNetArea = Math.max(0, partitionAreaGross - partitionOpeningsArea);
  const totalWallAreaNet = outerWallsCladdingArea + partitionsNetArea;

  // 3. Studs & Tracks count
  let totalStudsCount = 0;
  let totalDirectHangersCount = 0;
  let totalTracksLengthM = 0; // UW or UD

  const profileLength = config.profileLengthMeters || 3.0;

  // Outer walls framing
  if (config.constructionMode !== 'partition_only') {
    // Tracks for outer walls (Floor + Ceiling)
    totalTracksLengthM += totalPerimeter * 2 * 1.08; // 8% waste / overlap

    segments.forEach((seg, sIdx) => {
      const opsOnThisWall = config.openings.filter(o => o.wallIndex === sIdx);
      const studs = calculateStudLocations(seg.length, config.studSpacing, opsOnThisWall);
      totalStudsCount += studs.length;

      if (config.constructionMode === 'wall_lining_direct') {
        // Direct hangers: 1 every 80-90 cm of height per CD stud
        const hangersPerStud = Math.max(2, Math.ceil(wallHeightM / 0.85));
        totalDirectHangersCount += studs.length * hangersPerStud;
      }
    });
  }

  // Partition walls framing
  config.partitionWalls.forEach(p => {
    const pLenM = Math.hypot(p.endX - p.startX, p.endY - p.startY) / 100;
    // Tracks for floor and ceiling
    totalTracksLengthM += pLenM * 2 * 1.08;

    const pStuds = calculateStudLocations(pLenM * 100, config.studSpacing, p.openings || []);
    totalStudsCount += pStuds.length;
  });

  // Ceiling framing (if enabled)
  let ceilingCDLengthM = 0;
  let ceilingUDLengthM = 0;
  let ceilingHangersCount = 0;
  let ceilingCrossConnectors = 0;
  let ceilingCDConnectors = 0; // uzdužni nastavci

  if (config.ceilingMode === 'direct_cd') {
    // D113 jednorazinski strop: CD profili svakih 40cm/50cm + UD rubni
    const secondarySpacingM = (config.ceilingSecondarySpacing || 500) / 1000;
    ceilingCDLengthM = (totalCeilingArea / secondarySpacingM) * 1.08;
    ceilingUDLengthM = totalPerimeter * 1.08;
    const hangerSpacingM = (config.ceilingHangerSpacing || 800) / 1000;
    ceilingHangersCount = Math.ceil(totalCeilingArea / (secondarySpacingM * hangerSpacingM));
    ceilingCDConnectors = Math.ceil(ceilingCDLengthM / 3.0);
  } else if (config.ceilingMode === 'double_cd') {
    // D112 dvorazinski križni strop: primarni + montažni CD profili
    const primarySpacingM = (config.ceilingPrimarySpacing || 900) / 1000;
    const secondarySpacingM = (config.ceilingSecondarySpacing || 500) / 1000;
    const primaryCDLengthM = (totalCeilingArea / primarySpacingM) * 1.08;
    const secondaryCDLengthM = (totalCeilingArea / secondarySpacingM) * 1.08;
    ceilingCDLengthM = primaryCDLengthM + secondaryCDLengthM;
    ceilingUDLengthM = totalPerimeter * 1.08;
    const hangerSpacingM = (config.ceilingHangerSpacing || 800) / 1000;
    ceilingHangersCount = Math.ceil(totalCeilingArea / (primarySpacingM * hangerSpacingM));
    ceilingCrossConnectors = Math.ceil(totalCeilingArea / (primarySpacingM * secondarySpacingM));
    ceilingCDConnectors = Math.ceil(ceilingCDLengthM / 3.0);
  } else if (config.ceilingMode === 'freestanding_d116') {
    // D116 samonosivi strop CW/UW
    ceilingCDLengthM = totalCeilingArea * 2.8 * 1.08;
    ceilingUDLengthM = totalPerimeter * 1.08;
    ceilingHangersCount = 0; // bez ovjesa u strop
    ceilingCrossConnectors = 0;
    ceilingCDConnectors = 0;
  }

  // 4. Boards calculation & Detailed Cutting Plan
  let boardWidthM = 1.25;
  let boardLengthM = 2.0;
  if (config.boardSize === '2600x1200') {
    boardWidthM = 1.20;
    boardLengthM = 2.60;
  } else if (config.boardSize === '2500x1200') {
    boardWidthM = 1.20;
    boardLengthM = 2.50;
  }
  const singleBoardAreaM2 = boardWidthM * boardLengthM;

  const surfacesBreakdown: BoardSurfaceBreakdown[] = [];
  let sumFullBoards = 0;
  let sumCutBoards = 0;
  let sumCutsEstimated = 0;

  // Outer walls (if not partition only)
  if (config.constructionMode !== 'partition_only') {
    segments.forEach((seg, sIdx) => {
      const segLenM = seg.length / 100;
      const wallHM = wallHeightM;
      const grossArea = segLenM * wallHM;
      const ops = config.openings.filter(o => o.wallIndex === sIdx);
      const opsArea = ops.reduce((acc, o) => acc + (o.width / 100) * (o.height / 100), 0);
      const netArea = Math.max(0, grossArea - opsArea);
      const layers = config.boardLayers;

      const colsCount = Math.ceil(segLenM / boardWidthM);
      const isHeightFit = wallHM <= boardLengthM;
      const heightDifferenceM = Math.max(0, wallHM - boardLengthM);
      const lastColWidthM = (segLenM % boardWidthM === 0) ? boardWidthM : (segLenM % boardWidthM);
      const hasWidthCut = lastColWidthM < (boardWidthM - 0.02);

      let fullBoardsOnWall = 0;
      let cutPiecesOnWall = 0;
      let cutsOnWall = 0;
      const cutsNotes: string[] = [];

      for (let l = 1; l <= layers; l++) {
        for (let c = 0; c < colsCount; c++) {
          const isLastCol = c === colsCount - 1;
          if (isHeightFit) {
            if (isLastCol && hasWidthCut) {
              cutPiecesOnWall++;
              cutsOnWall++;
            } else {
              fullBoardsOnWall++;
            }
          } else {
            fullBoardsOnWall++;
            cutPiecesOnWall++;
            cutsOnWall++;
            if (isLastCol && hasWidthCut) {
              cutsOnWall++;
            }
          }
        }
      }

      ops.forEach(op => {
        cutPiecesOnWall += (op.type === 'door' ? 2 : 3) * layers;
        cutsOnWall += (op.type === 'door' ? 3 : 4) * layers;
        cutsNotes.push(`L-rez oko ${op.name} (${op.width}×${op.height} cm) - bez križnog spoja`);
      });

      if (!isHeightFit) {
        cutsNotes.push(`Visinski doštuk na ${(heightDifferenceM * 100).toFixed(0)} cm (smaknuto >40 cm)`);
      }
      if (hasWidthCut) {
        cutsNotes.push(`Završni rez širine ${(lastColWidthM * 100).toFixed(0)} cm`);
      }
      if (cutsNotes.length === 0) {
        cutsNotes.push('Puni raster bez dodatnog rezanja');
      }

      const totalSurfaceBoardArea = netArea * layers * 1.08;
      const surfaceBoardsCount = Math.ceil(totalSurfaceBoardArea / singleBoardAreaM2);

      sumFullBoards += fullBoardsOnWall;
      sumCutBoards += cutPiecesOnWall;
      sumCutsEstimated += cutsOnWall;

      surfacesBreakdown.push({
        surfaceName: `Zid ${sIdx + 1} (${seg.name})`,
        lengthM: Math.round(segLenM * 100) / 100,
        heightM: Math.round(wallHM * 100) / 100,
        areaGrossM2: Math.round(grossArea * 100) / 100,
        openingsAreaM2: Math.round(opsArea * 100) / 100,
        areaNetM2: Math.round(netArea * 100) / 100,
        layers,
        totalBoardAreaM2: Math.round(totalSurfaceBoardArea * 100) / 100,
        fullBoardsCount: fullBoardsOnWall,
        cutPiecesCount: cutPiecesOnWall,
        boardsUsedCount: surfaceBoardsCount,
        cutsSummary: cutsNotes,
      });
    });
  }

  // Partition walls
  config.partitionWalls.forEach((p, pIdx) => {
    const pLenM = Math.hypot(p.endX - p.startX, p.endY - p.startY) / 100;
    const pHM = (p.height || config.height) / 100;
    const grossAreaBothSides = pLenM * pHM * 2;
    const ops = p.openings || [];
    const opsAreaBothSides = ops.reduce((acc, o) => acc + (o.width / 100) * (o.height / 100) * 2, 0);
    const netAreaBothSides = Math.max(0, grossAreaBothSides - opsAreaBothSides);
    const layers = p.layers || 1;

    const isHeightFit = pHM <= boardLengthM;
    const heightDiffM = Math.max(0, pHM - boardLengthM);
    const colsCountPerSide = Math.ceil(pLenM / boardWidthM);
    const lastColWidthM = (pLenM % boardWidthM === 0) ? boardWidthM : (pLenM % boardWidthM);
    const hasWidthCut = lastColWidthM < (boardWidthM - 0.02);

    let fullBoardsOnPart = 0;
    let cutPiecesOnPart = 0;
    let cutsOnPart = 0;
    const cutsNotes: string[] = [];

    const totalSidesLayers = 2 * layers;
    for (let sl = 0; sl < totalSidesLayers; sl++) {
      for (let c = 0; c < colsCountPerSide; c++) {
        const isLastCol = c === colsCountPerSide - 1;
        if (isHeightFit) {
          if (isLastCol && hasWidthCut) {
            cutPiecesOnPart++;
            cutsOnPart++;
          } else {
            fullBoardsOnPart++;
          }
        } else {
          fullBoardsOnPart++;
          cutPiecesOnPart++;
          cutsOnPart++;
          if (isLastCol && hasWidthCut) {
            cutsOnPart++;
          }
        }
      }
    }

    ops.forEach(op => {
      cutPiecesOnPart += (op.type === 'door' ? 2 : 3) * totalSidesLayers;
      cutsOnPart += (op.type === 'door' ? 3 : 4) * totalSidesLayers;
      cutsNotes.push(`Obostrani L-rez oko ${op.name} (${op.width}×${op.height} cm)`);
    });

    if (!isHeightFit) {
      cutsNotes.push(`Visinski doštuk na ${(heightDiffM * 100).toFixed(0)} cm (smaknuto 40 cm)`);
    }
    if (hasWidthCut) {
      cutsNotes.push(`Završni rez širine ${(lastColWidthM * 100).toFixed(0)} cm`);
    }
    if (cutsNotes.length === 0) {
      cutsNotes.push('Obostrano puni formati ploča');
    }

    const totalPartBoardArea = netAreaBothSides * layers * 1.08;
    const partBoardsCount = Math.ceil(totalPartBoardArea / singleBoardAreaM2);

    sumFullBoards += fullBoardsOnPart;
    sumCutBoards += cutPiecesOnPart;
    sumCutsEstimated += cutsOnPart;

    surfacesBreakdown.push({
      surfaceName: p.name || `Pregradni zid ${pIdx + 1}`,
      lengthM: Math.round(pLenM * 100) / 100,
      heightM: Math.round(pHM * 100) / 100,
      areaGrossM2: Math.round(grossAreaBothSides * 100) / 100,
      openingsAreaM2: Math.round(opsAreaBothSides * 100) / 100,
      areaNetM2: Math.round(netAreaBothSides * 100) / 100,
      layers: p.layers,
      totalBoardAreaM2: Math.round(totalPartBoardArea * 100) / 100,
      fullBoardsCount: fullBoardsOnPart,
      cutPiecesCount: cutPiecesOnPart,
      boardsUsedCount: partBoardsCount,
      cutsSummary: cutsNotes,
    });
  });

  // Ceiling surface
  if (config.ceilingMode !== 'none' && totalCeilingArea > 0) {
    const ceilFull = Math.floor(totalCeilingArea / singleBoardAreaM2);
    const ceilCut = Math.ceil((totalCeilingArea % singleBoardAreaM2) / (singleBoardAreaM2 * 0.5)) + 4;
    const ceilCuts = ceilCut * 2;
    const ceilBoardArea = totalCeilingArea * 1.08;
    const ceilBoardsCount = Math.ceil(ceilBoardArea / singleBoardAreaM2);

    sumFullBoards += ceilFull;
    sumCutBoards += ceilCut;
    sumCutsEstimated += ceilCuts;

    surfacesBreakdown.push({
      surfaceName: `Spušteni strop (${config.ceilingMode === 'double_cd' ? 'D112' : 'D113'})`,
      lengthM: Math.round((config.length / 100) * 100) / 100,
      heightM: 0,
      areaGrossM2: Math.round(totalCeilingArea * 100) / 100,
      openingsAreaM2: 0,
      areaNetM2: Math.round(totalCeilingArea * 100) / 100,
      layers: 1,
      totalBoardAreaM2: Math.round(ceilBoardArea * 100) / 100,
      fullBoardsCount: ceilFull,
      cutPiecesCount: ceilCut,
      boardsUsedCount: ceilBoardsCount,
      cutsSummary: ['Rubno rezanje uz obodne UD profile', 'Poprečno smaknuti spojevi (križni spojevi zabranjeni)'],
    });
  }

  const totalEffectiveCladdingM2 = (totalWallAreaNet * config.boardLayers) + (totalCeilingArea * 1);
  const totalBoardAreaNeeded = totalEffectiveCladdingM2 * 1.08; // 8% waste for cutting
  const totalBoardsCount = Math.ceil(totalBoardAreaNeeded / singleBoardAreaM2);
  const totalBoughtBoardAreaM2 = totalBoardsCount * singleBoardAreaM2;
  const wasteAreaM2 = Math.max(0, totalBoughtBoardAreaM2 - totalEffectiveCladdingM2);
  const utilizationRatePercent = totalBoughtBoardAreaM2 > 0 ? Math.round((totalEffectiveCladdingM2 / totalBoughtBoardAreaM2) * 1000) / 10 : 92.5;
  const wastePercent = Math.round((100 - utilizationRatePercent) * 10) / 10;

  // Approximate full vs cut boards across total purchased count (with offcuts reuse)
  const calcCutBoards = Math.min(totalBoardsCount, Math.ceil(sumCutBoards * 0.55));
  const calcFullBoards = Math.max(0, totalBoardsCount - calcCutBoards);

  const boardCalculation: BoardCalculationDetails = {
    singleBoardWidthCm: Math.round(boardWidthM * 100),
    singleBoardLengthCm: Math.round(boardLengthM * 100),
    singleBoardAreaM2: Math.round(singleBoardAreaM2 * 100) / 100,
    totalFullBoardsCount: calcFullBoards,
    totalCutBoardsCount: calcCutBoards,
    totalBoardsCount,
    totalCutsEstimated: Math.max(calcCutBoards * 2, sumCutsEstimated),
    utilizationRatePercent,
    wastePercent,
    wasteAreaM2: Math.round(wasteAreaM2 * 100) / 100,
    surfaces: surfacesBreakdown,
  };

  // 5. Screws & Fasteners calculation
  // TN 25 screws: ~18 pcs/m² for layer 1
  const tn25Count = Math.ceil(totalEffectiveCladdingM2 * 18);
  // TN 35 screws: ~18 pcs/m² for layer 2 (if 2 layers selected)
  const tn35Count = config.boardLayers === 2 ? Math.ceil(totalWallAreaNet * 18) : 0;
  // Impact anchors (udarni tipli 6x40): 1 piece every 50cm for tracks
  const totalTrackPerimeterM = totalTracksLengthM + ceilingUDLengthM;
  const impactAnchorsCount = Math.ceil(totalTrackPerimeterM * 1.8);
  // Acoustic sealing tape (PE brtvena traka 30m rola): length equal to tracks
  const acousticTapeMeters = totalTrackPerimeterM;
  const acousticTapeRolls = Math.ceil(acousticTapeMeters / 30);
  // LN self-drilling screws for metal-metal connection ("bubice"): ~4 per stud + openings
  const lnScrewsCount = Math.ceil(totalStudsCount * 6 + (config.openings.length * 16));

  // 6. Insulation Calculation & Detailed Breakdown (Deducting Doors & Windows)
  const insulationSurfaces: InsulationSurfaceBreakdown[] = [];
  let totalInsulationGrossM2 = 0;
  let totalInsulationOpeningsM2 = 0;
  let totalInsulationNetM2 = 0;

  if (config.hasInsulation) {
    // Outer walls
    if (config.constructionMode !== 'partition_only') {
      segments.forEach((seg, sIdx) => {
        const segLenM = seg.length / 100;
        const grossArea = segLenM * wallHeightM;
        const ops = config.openings.filter(o => o.wallIndex === sIdx);
        const opsArea = ops.reduce((acc, o) => acc + (o.width / 100) * (o.height / 100), 0);
        const netArea = Math.max(0, grossArea - opsArea);
        const pkgs = Math.ceil((netArea * 1.05) / 9.6);

        totalInsulationGrossM2 += grossArea;
        totalInsulationOpeningsM2 += opsArea;
        totalInsulationNetM2 += netArea;

        const piecesNotes: string[] = [];
        if (ops.length > 0) {
          ops.forEach(op => {
            if (op.type === 'door') {
              piecesNotes.push(`Isključen prolaz vrata ${op.name} (${(op.width / 100).toFixed(2)}×${(op.height / 100).toFixed(2)}m) - vuna ugrađena bočno i iznad nadvratnika`);
            } else {
              piecesNotes.push(`Isključen otvor prozora ${op.name} (${(op.width / 100).toFixed(2)}×${(op.height / 100).toFixed(2)}m) - vuna ugrađena bočno, u parapet i nadvratnik`);
            }
          });
        } else {
          piecesNotes.push('Puni raster mineralne vune između svih CW vertikala');
        }

        insulationSurfaces.push({
          surfaceName: `Zid ${sIdx + 1} (${seg.name})`,
          lengthM: Math.round(segLenM * 100) / 100,
          heightM: Math.round(wallHeightM * 100) / 100,
          areaGrossM2: Math.round(grossArea * 100) / 100,
          openingsAreaM2: Math.round(opsArea * 100) / 100,
          areaNetM2: Math.round(netArea * 100) / 100,
          packagesNeeded: pkgs,
          piecesSummary: piecesNotes,
        });
      });
    }

    // Partition walls
    config.partitionWalls.forEach((p, pIdx) => {
      if (p.hasInsulation !== false) {
        const pLenM = Math.hypot(p.endX - p.startX, p.endY - p.startY) / 100;
        const pHM = (p.height || config.height) / 100;
        const grossArea = pLenM * pHM;
        const ops = p.openings || [];
        const opsArea = ops.reduce((acc, o) => acc + (o.width / 100) * (o.height / 100), 0);
        const netArea = Math.max(0, grossArea - opsArea);
        const pkgs = Math.ceil((netArea * 1.05) / 9.6);

        totalInsulationGrossM2 += grossArea;
        totalInsulationOpeningsM2 += opsArea;
        totalInsulationNetM2 += netArea;

        const piecesNotes: string[] = [];
        if (ops.length > 0) {
          ops.forEach(op => {
            piecesNotes.push(`Isključen otvor ${op.name} (${(op.width / 100).toFixed(2)}×${(op.height / 100).toFixed(2)}m)`);
          });
        } else {
          piecesNotes.push('Puni raster mineralne vune u jezgri pregrade');
        }

        insulationSurfaces.push({
          surfaceName: `Pregrada ${pIdx + 1} (${p.name})`,
          lengthM: Math.round(pLenM * 100) / 100,
          heightM: Math.round(pHM * 100) / 100,
          areaGrossM2: Math.round(grossArea * 100) / 100,
          openingsAreaM2: Math.round(opsArea * 100) / 100,
          areaNetM2: Math.round(netArea * 100) / 100,
          packagesNeeded: pkgs,
          piecesSummary: piecesNotes,
        });
      }
    });

    // Ceiling insulation
    if (config.ceilingMode !== 'none' && config.ceilingHasInsulation) {
      const ceilArea = totalCeilingArea;
      const pkgs = Math.ceil((ceilArea * 1.05) / 9.6);
      totalInsulationGrossM2 += ceilArea;
      totalInsulationNetM2 += ceilArea;

      insulationSurfaces.push({
        surfaceName: 'Spušteni strop (Plenum)',
        lengthM: Math.round(totalPerimeter * 100) / 100,
        heightM: 0,
        areaGrossM2: Math.round(ceilArea * 100) / 100,
        openingsAreaM2: 0,
        areaNetM2: Math.round(ceilArea * 100) / 100,
        packagesNeeded: pkgs,
        piecesSummary: ['Toplinska i akustična vuna položena iznad CD konstrukcije'],
      });
    }
  }

  const totalInsulationAreaM2 = config.hasInsulation ? (totalInsulationNetM2 * 1.05) : 0;
  const insulationPackagesCount = config.hasInsulation ? Math.ceil(totalInsulationAreaM2 / 9.6) : 0; // ~9.6m² per roll/pack

  const insulationCalculation: InsulationCalculationDetails = {
    totalGrossAreaM2: Math.round(totalInsulationGrossM2 * 100) / 100,
    totalOpeningsAreaM2: Math.round(totalInsulationOpeningsM2 * 100) / 100,
    totalNetInsulationAreaM2: Math.round(totalInsulationNetM2 * 100) / 100,
    totalPackagesNeeded: insulationPackagesCount,
    singlePackageAreaM2: 9.6,
    surfaces: insulationSurfaces,
  };

  // 7. Joint finishing
  // Knauf Uniflott / Fugenfüller: ~0.35 kg/m² for 1 layer, 0.65 kg/m² for 2 layers
  const kgJointFillerPerM2 = config.boardLayers === 2 ? 0.65 : 0.38;
  const totalJointFillerKg = Math.ceil(totalEffectiveCladdingM2 * kgJointFillerPerM2);
  const jointFillerBags5kg = Math.ceil(totalJointFillerKg / 5);

  // Joint tape (bandažna traka): ~1.3 m per m²
  const jointTapeMeters = Math.ceil(totalEffectiveCladdingM2 * 1.35);
  const jointTapeRolls90m = Math.ceil(jointTapeMeters / 90);

  // Finish putty (završna glet masa): ~0.25 kg/m²
  const finishPuttyKg = Math.ceil(totalEffectiveCladdingM2 * 0.25);
  const finishPuttyBuckets20kg = Math.ceil(finishPuttyKg / 20);

  // 8. Generate Material Items (BOM)
  const items: MaterialItem[] = [];

  // Determine profile types based on config
  const isDirectCD = config.constructionMode === 'wall_lining_direct';
  const studProfileName = isDirectCD ? 'CD 60/27 profil' : `${config.studProfile.replace('_', ' ')} profil`;
  const trackProfileName = isDirectCD ? 'UD 28/27 profil' : `${config.trackProfile.replace('_', ' ')} profil`;

  // Verticals (CW or CD)
  const totalVerticalsPieces = Math.ceil(totalStudsCount * (wallHeightM / profileLength));
  const studPriceKey = isDirectCD ? 'cd60_3m' : config.studProfile === 'CW_50' ? 'cw50_3m' : config.studProfile === 'CW_75' ? 'cw75_3m' : 'cw100_3m';
  items.push({
    id: 'mat_studs',
    category: 'profiles',
    name: `${studProfileName} (L=${profileLength}m)`,
    code: isDirectCD ? 'KNAUF-CD-6027' : `KNAUF-${config.studProfile}`,
    unit: 'kom',
    exactQuantity: totalStudsCount,
    packageSize: 1,
    packageUnit: 'kom',
    packagesNeeded: totalVerticalsPieces,
    unitPrice: prices[studPriceKey] || 5.80,
    totalPrice: totalVerticalsPieces * (prices[studPriceKey] || 5.80),
    description: `Vertikalni nosivi profili na razmaku ${config.studSpacing} mm za ${segments.length} zidova i pregrade.`,
    formulaNote: `${totalStudsCount} pozicija vertikala x faktor visine (${wallHeightM.toFixed(2)}m / ${profileLength}m)`,
  });

  // Horizontals (UW or UD)
  const totalTracksPieces = Math.ceil(totalTracksLengthM / profileLength);
  const trackPriceKey = isDirectCD ? 'ud28_3m' : config.trackProfile === 'UW_50' ? 'uw50_3m' : config.trackProfile === 'UW_75' ? 'uw75_3m' : 'uw100_3m';
  items.push({
    id: 'mat_tracks',
    category: 'profiles',
    name: `${trackProfileName} (L=${profileLength}m)`,
    code: isDirectCD ? 'KNAUF-UD-2827' : `KNAUF-${config.trackProfile}`,
    unit: 'kom',
    exactQuantity: Math.round(totalTracksLengthM * 10) / 10,
    packageSize: 1,
    packageUnit: 'kom',
    packagesNeeded: totalTracksPieces,
    unitPrice: prices[trackPriceKey] || 4.90,
    totalPrice: totalTracksPieces * (prices[trackPriceKey] || 4.90),
    description: 'Vodoravni podni i stropni rubni profili (uključujući pregrade i nadvratnike).',
    formulaNote: `${totalTracksLengthM.toFixed(1)} m ukupne dužine / ${profileLength}m po profilu`,
  });

  // UA Door frame profiles (if selected)
  if (uaDoorsCount > 0) {
    const uaPieces = uaDoorsCount * 2;
    const uaBracketSets = uaDoorsCount * 4; // 4 brackets per door (2 top, 2 bottom)
    items.push({
      id: 'mat_ua_profiles',
      category: 'profiles',
      name: `UA 75 ojačani profil 2.0mm (L=${profileLength}m)`,
      code: 'KNAUF-UA-75',
      unit: 'kom',
      exactQuantity: uaPieces,
      packageSize: 1,
      packageUnit: 'kom',
      packagesNeeded: uaPieces,
      unitPrice: prices['ua75_3m'] || 24.50,
      totalPrice: uaPieces * (prices['ua75_3m'] || 24.50),
      description: `Pojačani čelični profili za ${uaDoorsCount} otvora vrata s teškim vratnim krilom.`,
      formulaNote: `${uaDoorsCount} vrata x 2 okomita stupa dovratnika`,
    });

    items.push({
      id: 'mat_ua_brackets',
      category: 'hangers_connectors',
      name: 'UA Priključni kutnik set s vijcima (gore/dolje)',
      code: 'KNAUF-UA-WINKEL',
      unit: 'kom',
      exactQuantity: uaBracketSets,
      packageSize: 4,
      packageUnit: 'set (4 kom)',
      packagesNeeded: uaDoorsCount,
      unitPrice: prices['ua_bracket_set'] || 14.50,
      totalPrice: uaDoorsCount * (prices['ua_bracket_set'] || 14.50),
      description: 'Čelični kutnici za čvrsto sidrenje UA profila u podnu i stropnu armiranu ploču.',
      formulaNote: `${uaDoorsCount} vrata x 4 kutnika (2 pod + 2 strop)`,
    });
  }

  // Ceiling profiles (if ceiling enabled)
  if (config.ceilingMode !== 'none') {
    const ceilingCDPieces = Math.ceil(ceilingCDLengthM / profileLength);
    const ceilingUDPieces = Math.ceil(ceilingUDLengthM / profileLength);

    // 1. CD 60/27 Ceiling Profiles
    items.push({
      id: 'mat_ceiling_cd',
      category: 'profiles',
      name: `CD 60/27 profil za strop (L=${profileLength}m)`,
      code: 'KNAUF-CD-CEILING',
      unit: 'kom',
      exactQuantity: Math.round(ceilingCDLengthM * 10) / 10,
      packageSize: 1,
      packageUnit: 'kom',
      packagesNeeded: ceilingCDPieces,
      unitPrice: prices['cd60_3m'] || 4.20,
      totalPrice: ceilingCDPieces * (prices['cd60_3m'] || 4.20),
      description: `Stropna nosiva i montažna potkonstrukcija (${config.ceilingMode === 'double_cd' ? 'Knauf D112 dvorazinska' : config.ceilingMode === 'direct_cd' ? 'Knauf D113 jednorazinska' : 'Knauf D116 samonosiva'}).`,
      formulaNote: `${ceilingCDLengthM.toFixed(1)} m CD profila / ${profileLength}m`,
    });

    // 2. UD 28/27 Perimeter Profiles
    items.push({
      id: 'mat_ceiling_ud',
      category: 'profiles',
      name: `UD 28/27 rubni stropni profil (L=${profileLength}m)`,
      code: 'KNAUF-UD-CEILING',
      unit: 'kom',
      exactQuantity: Math.round(ceilingUDLengthM * 10) / 10,
      packageSize: 1,
      packageUnit: 'kom',
      packagesNeeded: ceilingUDPieces,
      unitPrice: prices['ud28_3m'] || 3.10,
      totalPrice: ceilingUDPieces * (prices['ud28_3m'] || 3.10),
      description: 'Zidni prihvatni profili po obodu stropa (montirani s PE brtvenom trakom).',
      formulaNote: `${ceilingUDLengthM.toFixed(1)} m oboda / ${profileLength}m`,
    });

    // 3. Ceiling Hangers according to selected type
    if (config.ceilingMode !== 'freestanding_d116' && ceilingHangersCount > 0) {
      const hangerType = config.ceilingHangerType || 'wire_anchor';
      const hangerBoxes = Math.ceil(ceilingHangersCount / 100);

      if (hangerType === 'wire_anchor') {
        // Wire + Anchor
        items.push({
          id: 'mat_ceiling_anchor_hangers',
          category: 'hangers_connectors',
          name: 'Knauf Sidreni ovjes (anker) s oprugom za CD 60/27',
          code: 'KNAUF-ANKER-CD60',
          unit: 'kom',
          exactQuantity: ceilingHangersCount,
          packageSize: 100,
          packageUnit: 'kutija (100 kom)',
          packagesNeeded: hangerBoxes,
          unitPrice: 36.00,
          totalPrice: hangerBoxes * 36.00,
          description: 'Sidreni ovjes s brzom oprugom za fino niveliranje visine stropa.',
          formulaNote: `${ceilingHangersCount} točaka ovjesa (razmak ~${config.ceilingHangerSpacing || 800} mm)`,
        });

        const wireLen = config.ceilingDropDistanceCm > 45 ? '1000 mm' : config.ceilingDropDistanceCm > 20 ? '500 mm' : '250 mm';
        items.push({
          id: 'mat_ceiling_wire',
          category: 'hangers_connectors',
          name: `Knauf Žica s ušicom L=${wireLen}`,
          code: 'KNAUF-DRAHT-OESE',
          unit: 'kom',
          exactQuantity: ceilingHangersCount,
          packageSize: 100,
          packageUnit: 'snop (100 kom)',
          packagesNeeded: hangerBoxes,
          unitPrice: 18.50,
          totalPrice: hangerBoxes * 18.50,
          description: `Pocinčana čelična žica 4mm za spuštanje stropa (visina spuštanja ${config.ceilingDropDistanceCm || 15} cm).`,
          formulaNote: `1 žica po sidrenom ovjesu (${ceilingHangersCount} kom)`,
        });
      } else if (hangerType === 'direct_hanger') {
        // Direct hangers
        items.push({
          id: 'mat_ceiling_direct_hangers',
          category: 'hangers_connectors',
          name: 'Knauf Direktni nosač za CD 60/27 (120mm)',
          code: 'KNAUF-DIREKT-CD60',
          unit: 'kom',
          exactQuantity: ceilingHangersCount,
          packageSize: 100,
          packageUnit: 'kutija (100 kom)',
          packagesNeeded: hangerBoxes,
          unitPrice: 34.00,
          totalPrice: hangerBoxes * 34.00,
          description: 'Krut nosač za minimalno spuštanje stropa (do 12 cm).',
          formulaNote: `${ceilingHangersCount} točaka nosača`,
        });
      } else {
        // Nonius heavy-duty
        items.push({
          id: 'mat_ceiling_nonius_hangers',
          category: 'hangers_connectors',
          name: 'Knauf Nonius ovjes za CD 60 (gornji + donji dio + osigurači)',
          code: 'KNAUF-NONIUS-SET',
          unit: 'set',
          exactQuantity: ceilingHangersCount,
          packageSize: 100,
          packageUnit: 'set (100 kom)',
          packagesNeeded: hangerBoxes,
          unitPrice: 72.00,
          totalPrice: hangerBoxes * 72.00,
          description: 'Visokonoseći i protupožarni kruti ovjes za veća opterećenja i zvučnu izolaciju.',
          formulaNote: `${ceilingHangersCount} kompletnih nonius točaka`,
        });
      }

      // 4. Knauf Deckennagel DN6 ceiling steel pins (mandatory for fire safety in concrete slab)
      items.push({
        id: 'mat_ceiling_steel_pins',
        category: 'fasteners',
        name: 'Knauf Stropni čelični klin DN 6x35 mm (Deckennagel)',
        code: 'KNAUF-DN6-DECKENNAGEL',
        unit: 'kom',
        exactQuantity: ceilingHangersCount,
        packageSize: 100,
        packageUnit: 'kutija (100 kom)',
        packagesNeeded: hangerBoxes,
        unitPrice: 19.50,
        totalPrice: hangerBoxes * 19.50,
        description: 'Atestirani čelični udarni tipli za sigurno protupožarno sidrenje ovjesa u betonski strop.',
        formulaNote: `1 čelični klin po svakom ovjesu (${ceilingHangersCount} kom)`,
      });
    }

    // 5. Cross connectors for D112 double CD
    if (config.ceilingMode === 'double_cd' && ceilingCrossConnectors > 0) {
      const crossBoxes = Math.ceil(ceilingCrossConnectors / 100);
      items.push({
        id: 'mat_ceiling_cross',
        category: 'hangers_connectors',
        name: 'Knauf Križna spojnica za CD 60/27 (Kreuzverbinder)',
        code: 'KNAUF-KREUZVERBINDER',
        unit: 'kom',
        exactQuantity: ceilingCrossConnectors,
        packageSize: 100,
        packageUnit: 'kutija (100 kom)',
        packagesNeeded: crossBoxes,
        unitPrice: 42.00,
        totalPrice: crossBoxes * 42.00,
        description: 'Spojnica za čvrsto spajanje nosivih i montažnih CD profila u dvije razine (Knauf D112).',
        formulaNote: `${ceilingCrossConnectors} sjecišta primarnih i montažnih profila`,
      });
    }

    // 6. Longitudinal CD connectors (Längsverbinder)
    if (ceilingCDConnectors > 0) {
      const connBoxes = Math.ceil(ceilingCDConnectors / 100);
      items.push({
        id: 'mat_ceiling_cd_connectors',
        category: 'hangers_connectors',
        name: 'Knauf Uzdužni nastavak za CD 60/27 (Längsverbinder)',
        code: 'KNAUF-LAENGSVERBINDER',
        unit: 'kom',
        exactQuantity: ceilingCDConnectors,
        packageSize: 100,
        packageUnit: 'kutija (100 kom)',
        packagesNeeded: Math.max(1, connBoxes),
        unitPrice: 28.00,
        totalPrice: Math.max(1, connBoxes) * 28.00,
        description: 'Spojni elementi za uzdužno nastavljanje CD profila na većim rasponima.',
        formulaNote: `${ceilingCDConnectors} kom za nastavljanje ${ceilingCDLengthM.toFixed(0)}m CD profila`,
      });
    }
  }

  // Direct hangers for direct wall lining
  if (config.constructionMode === 'wall_lining_direct' && totalDirectHangersCount > 0) {
    const hangerBoxes = Math.ceil(totalDirectHangersCount / 100);
    items.push({
      id: 'mat_direct_hangers',
      category: 'hangers_connectors',
      name: 'Direktni nosač za CD 60/27 (120mm)',
      code: 'KNAUF-DIREKTHANGER',
      unit: 'kom',
      exactQuantity: totalDirectHangersCount,
      packageSize: 100,
      packageUnit: 'kutija (100 kom)',
      packagesNeeded: hangerBoxes,
      unitPrice: 34.00, // box of 100
      totalPrice: hangerBoxes * 34.00,
      description: 'Pocinčani nosači za sidrenje CD profila u masivni zid.',
      formulaNote: `${totalStudsCount} vertikala x ${Math.ceil(wallHeightM / 0.85)} nosača po visini`,
    });
  }

  // Acoustic PE sealing tape
  items.push({
    id: 'mat_acoustic_tape',
    category: 'hangers_connectors',
    name: 'Akustična PE brtvena traka (rola 30m)',
    code: 'KNAUF-DICHTUNGSBAND',
    unit: 'rola',
    exactQuantity: Math.round(acousticTapeMeters * 10) / 10,
    packageSize: 30,
    packageUnit: 'rola (30m)',
    packagesNeeded: acousticTapeRolls,
    unitPrice: prices['acoustic_tape_30m'] || 8.90,
    totalPrice: acousticTapeRolls * (prices['acoustic_tape_30m'] || 8.90),
    description: 'Samoljepljiva traka za zvučno i zračno brtvljenje ispod svih rubnih profila.',
    formulaNote: `${acousticTapeMeters.toFixed(1)} m rubnih profila / 30m po roli`,
  });

  // Screws: TN 25
  const tn25Boxes = Math.ceil(tn25Count / 1000);
  items.push({
    id: 'mat_screws_tn25',
    category: 'fasteners',
    name: 'Vijci za gips Knauf TN 3.5x25 mm',
    code: 'KNAUF-TN25-1000',
    unit: 'kom',
    exactQuantity: tn25Count,
    packageSize: 1000,
    packageUnit: 'kutija (1000 kom)',
    packagesNeeded: Math.max(1, tn25Boxes),
    unitPrice: prices['screws_tn25_1000'] || 11.50,
    totalPrice: Math.max(1, tn25Boxes) * (prices['screws_tn25_1000'] || 11.50),
    description: 'Fosfatirani samonarezni vijci za pričvršćivanje 1. sloja ploča u profile.',
    formulaNote: `18 kom/m² x ${totalEffectiveCladdingM2.toFixed(1)} m² površine`,
  });

  // Screws: TN 35 (if layer 2)
  if (config.boardLayers === 2) {
    const tn35Boxes = Math.ceil(tn35Count / 1000);
    items.push({
      id: 'mat_screws_tn35',
      category: 'fasteners',
      name: 'Vijci za gips Knauf TN 3.5x35 mm',
      code: 'KNAUF-TN35-1000',
      unit: 'kom',
      exactQuantity: tn35Count,
      packageSize: 1000,
      packageUnit: 'kutija (1000 kom)',
      packagesNeeded: Math.max(1, tn35Boxes),
      unitPrice: prices['screws_tn35_1000'] || 14.20,
      totalPrice: Math.max(1, tn35Boxes) * (prices['screws_tn35_1000'] || 14.20),
      description: 'Dulji vijci za pričvršćivanje 2. sloja gipskartonskih ploča.',
      formulaNote: `18 kom/m² x ${totalWallAreaNet.toFixed(1)} m² zida`,
    });
  }

  // Impact Anchors 6x40mm
  const anchorBoxes = Math.ceil(impactAnchorsCount / 100);
  items.push({
    id: 'mat_anchors',
    category: 'fasteners',
    name: 'Udarni tipli s vijkom 6x40 mm',
    code: 'KNAUF-DREHSTIFT-640',
    unit: 'kom',
    exactQuantity: impactAnchorsCount,
    packageSize: 100,
    packageUnit: 'kutija (100 kom)',
    packagesNeeded: Math.max(1, anchorBoxes),
    unitPrice: prices['impact_anchors_6x40_100'] || 7.50,
    totalPrice: Math.max(1, anchorBoxes) * (prices['impact_anchors_6x40_100'] || 7.50),
    description: 'Za brzo udarno pričvršćivanje UW/UD profila u pod, strop i masivne zidove (svakih ~50-60cm).',
    formulaNote: `${totalTrackPerimeterM.toFixed(1)} m rubnih profila x 1.8 tipli/m`,
  });

  // LN 3.5x9mm ("bubice")
  const lnBoxes = Math.ceil(lnScrewsCount / 1000);
  items.push({
    id: 'mat_screws_ln',
    category: 'fasteners',
    name: 'Lim-lim vijci Knauf LN 3.5x9.5 mm ("bubice")',
    code: 'KNAUF-LN-BUBICE',
    unit: 'kom',
    exactQuantity: lnScrewsCount,
    packageSize: 1000,
    packageUnit: 'kutija (1000 kom)',
    packagesNeeded: Math.max(1, lnBoxes),
    unitPrice: prices['screws_ln_screw_1000'] || 12.80,
    totalPrice: Math.max(1, lnBoxes) * (prices['screws_ln_screw_1000'] || 12.80),
    description: 'Samobušeći vijci za međusobno spajanje profila i nadvoja iznad otvora.',
    formulaNote: `${totalStudsCount} vertikala x 6 vijaka + spojevi otvora`,
  });

  // Gypsum Boards
  let boardName = 'Knauf A (GKB) Standardna ploča 12.5mm';
  let boardCode = 'KNAUF-GKB-125';
  let boardPriceKey = 'board_std_white';

  if (config.boardType === 'moisture_resistant') {
    boardName = 'Knauf H2 (GKBI) Impregnirana vlagootporna ploča 12.5mm';
    boardCode = 'KNAUF-GKBI-GREEN';
    boardPriceKey = 'board_moisture_green';
  } else if (config.boardType === 'fire_resistant') {
    boardName = 'Knauf F (GKF) Vatrootporna ploča 12.5mm';
    boardCode = 'KNAUF-GKF-RED';
    boardPriceKey = 'board_fire_red';
  } else if (config.boardType === 'acoustic_diamant') {
    boardName = 'Knauf Diamant Tvrda akustična ploča 12.5mm';
    boardCode = 'KNAUF-DIAMANT-BLUE';
    boardPriceKey = 'board_acoustic_blue';
  }

  items.push({
    id: 'mat_boards',
    category: 'boards',
    name: `${boardName} (${config.boardSize.replace('x', '×')} mm)`,
    code: boardCode,
    unit: 'ploča',
    exactQuantity: Math.round((totalBoardAreaNeeded / singleBoardAreaM2) * 10) / 10,
    packageSize: 1,
    packageUnit: 'ploča (2.5 m²)',
    packagesNeeded: totalBoardsCount,
    unitPrice: prices[boardPriceKey] || 8.90,
    totalPrice: totalBoardsCount * (prices[boardPriceKey] || 8.90),
    description: `Gipskartonske ploče za ${config.boardLayers === 2 ? 'dvostruku (2 sloja)' : 'jednostruku (1 sloj)'} oblogu zidova${config.ceilingMode !== 'none' ? ' i strop' : ''}.`,
    formulaNote: `${totalEffectiveCladdingM2.toFixed(1)} m² neto obloge + 8% rez (${totalBoardAreaNeeded.toFixed(1)} m²) / ${singleBoardAreaM2} m² po ploči`,
  });

  // Insulation (if enabled)
  if (config.hasInsulation) {
    const woolPriceKey = config.insulationType === 'mineral_wool_75' ? 'mineral_wool_75_pkg' : config.insulationType === 'mineral_wool_100' ? 'mineral_wool_100_pkg' : 'mineral_wool_50_pkg';
    const woolThick = config.insulationType.includes('100') ? '100mm' : config.insulationType.includes('75') ? '75mm' : '50mm';
    
    items.push({
      id: 'mat_insulation',
      category: 'insulation',
      name: `Mineralna staklena/kamena vuna Knauf Insulation NaturBoard (${woolThick})`,
      code: 'KNAUF-INSUL-NATUR',
      unit: 'm²',
      exactQuantity: Math.round(totalInsulationAreaM2 * 10) / 10,
      packageSize: 9.6,
      packageUnit: 'paket (9.6 m²)',
      packagesNeeded: insulationPackagesCount,
      unitPrice: prices[woolPriceKey] || 28.50,
      totalPrice: insulationPackagesCount * (prices[woolPriceKey] || 28.50),
      description: 'Zvučna i toplinska izolacija za postavljanje između CW/CD profila u šupljinu.',
      formulaNote: `${totalInsulationAreaM2.toFixed(1)} m² potrebne izolacije / 9.6 m² po paketu`,
    });
  }

  // Joint Compound: Knauf Uniflott / Fugenfüller
  items.push({
    id: 'mat_joint_filler',
    category: 'finishing',
    name: 'Knauf Uniflott / Fugenfüller masa za obradu spojeva (vreća 5kg)',
    code: 'KNAUF-UNIFLOTT-5KG',
    unit: 'kg',
    exactQuantity: totalJointFillerKg,
    packageSize: 5,
    packageUnit: 'vreća (5 kg)',
    packagesNeeded: jointFillerBags5kg,
    unitPrice: prices['uniflott_5kg'] || 12.90,
    totalPrice: jointFillerBags5kg * (prices['uniflott_5kg'] || 12.90),
    description: 'Visokočvrsta masa za fugiranje spojeva gipskartonskih ploča s HRAK rubovima.',
    formulaNote: `${kgJointFillerPerM2} kg/m² x ${totalEffectiveCladdingM2.toFixed(1)} m² = ${totalJointFillerKg} kg`,
  });

  // Joint Tape (Bandažna traka)
  items.push({
    id: 'mat_joint_tape',
    category: 'finishing',
    name: 'Bandažna armaturna staklena mrežica / traka (rola 90m)',
    code: 'KNAUF-GLASGITTER-90',
    unit: 'rola',
    exactQuantity: jointTapeMeters,
    packageSize: 90,
    packageUnit: 'rola (90m)',
    packagesNeeded: jointTapeRolls90m,
    unitPrice: prices['joint_tape_90m'] || 6.50,
    totalPrice: jointTapeRolls90m * (prices['joint_tape_90m'] || 6.50),
    description: 'Armaturna traka za sprječavanje pucanja na ravnim spojevima ploča.',
    formulaNote: `${jointTapeMeters} dužnih metara spojeva / 90m po roli`,
  });

  // Flexible Corner Tape for crooked/non-90° angles (Dallas / Knauf Fleksibilna traka)
  if (config.constructionMode === 'wall_lining_direct' && crookedCornersCount > 0) {
    const flexTapeMeters = Math.ceil(crookedCornersCount * wallHeightM * 1.1);
    const flexTapeRolls = Math.max(1, Math.ceil(flexTapeMeters / 30));
    items.push({
      id: 'mat_flexible_corner_tape',
      category: 'finishing',
      name: 'Knauf Dallas / Fleksibilna kompozitna kutna traka za kose kuteve (30m)',
      code: 'KNAUF-DALLAS-FLEX-30M',
      unit: 'rola',
      exactQuantity: flexTapeMeters,
      packageSize: 30,
      packageUnit: 'rola (30m)',
      packagesNeeded: flexTapeRolls,
      unitPrice: prices['flexible_corner_tape_30m'] || 14.50,
      totalPrice: flexTapeRolls * (prices['flexible_corner_tape_30m'] || 14.50),
      description: `Specijalna traka s metalnim/kompozitnim ojačanjem za oštre i tupe kuteve (${crookedCornersCount} kosih kuteva odstupanja od 90°).`,
      formulaNote: `${crookedCornersCount} kosa kuta x ${wallHeightM.toFixed(2)}m visine zida`,
    });
  }

  // Finish Putty
  items.push({
    id: 'mat_finish_putty',
    category: 'finishing',
    name: 'Knauf Super Finish završna glet masa (kanta 20kg)',
    code: 'KNAUF-SUPERFINISH-20',
    unit: 'kanta',
    exactQuantity: finishPuttyKg,
    packageSize: 20,
    packageUnit: 'kanta (20 kg)',
    packagesNeeded: finishPuttyBuckets20kg,
    unitPrice: prices['finish_putty_20kg'] || 19.50,
    totalPrice: finishPuttyBuckets20kg * (prices['finish_putty_20kg'] || 19.50),
    description: 'Gotova masa za završno fino gletanje do kvalitete površine Q2-Q3.',
    formulaNote: `0.25 kg/m² x ${totalEffectiveCladdingM2.toFixed(1)} m² = ${finishPuttyKg} kg`,
  });

  // Totals
  const netTotalCost = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const vatRate = 0.25; // 25% PDV
  const vatAmount = netTotalCost * vatRate;
  const grandTotalCost = netTotalCost + vatAmount;

  // Additional helpful tips based on configuration
  if (config.boardLayers === 1 && config.studSpacing === 600) {
    recommendations.push(
      '💡 Za prostore gdje se planira keramička obloga (kupaonice, kuhinje), preporučuje se 2 sloja vlagootpornih ploča ili smanjenje razmaka vertikala na 400 mm radi veće nosivosti i krutosti.'
    );
  }

  if (config.hasInsulation) {
    recommendations.push(
      '✓ Mineralna vuna znatno povećava zvučnu izolaciju (za do 8-12 dB) i sprečava efekt "šupljeg zida".'
    );
  }

  return {
    totalWallAreaGross: Math.round(totalWallAreaGross * 100) / 100,
    totalOpeningsArea: Math.round(totalOpeningsArea * 100) / 100,
    totalWallAreaNet: Math.round(totalWallAreaNet * 100) / 100,
    totalCeilingArea: Math.round(totalCeilingArea * 100) / 100,
    totalBoardAreaNeeded: Math.round(totalBoardAreaNeeded * 100) / 100,
    totalPerimeter: Math.round(totalPerimeter * 100) / 100,
    isAsymmetrical,
    maxAngleDeviationDeg: maxDevDeg,
    squareCorrectionVolumeLost: straightened.areaLostM2,
    boardCalculation,
    insulationCalculation,
    totalStudsCount,
    totalTracksLengthM: Math.round(totalTracksLengthM * 10) / 10,
    totalOpeningsCount: config.openings.length + config.partitionWalls.reduce((sum, p) => sum + (p.openings?.length || 0), 0),
    totalPartitionsLengthM: Math.round(totalPartitionsLengthM * 10) / 10,
    items,
    netTotalCost: Math.round(netTotalCost * 100) / 100,
    vatRate,
    vatAmount: Math.round(vatAmount * 100) / 100,
    grandTotalCost: Math.round(grandTotalCost * 100) / 100,
    recommendations,
  };
}

export const calculateDrywallMaterials = calculateDrywallBOM;

