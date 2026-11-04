export type RoomShapeType = 'rectangular' | 'asymmetric' | 'l_shaped';

export type ConstructionMode = 
  | 'wall_lining_direct'    // Knauf W623: CD 60/27 + UD 28/27 na direktnim nosačima
  | 'freestanding_lining'   // Knauf W625/W626: Samostojeći predzid CW + UW (za instalacije i izravnavanje)
  | 'partition_only';       // Samo pregradni zidovi

export type CeilingMode = 
  | 'none'                  // Bez spuštenog stropa
  | 'direct_cd'             // D113: Jednorazinska CD/UD podkonstrukcija
  | 'double_cd'             // D112: Dvorazinska križna CD/UD podkonstrukcija
  | 'freestanding_d116';    // D116: Samonosivi strop s rasponskim profilima

export type CeilingHangerType = 
  | 'direct_hanger'         // Direktni nosač za CD 60/27 (spuštanje do 12-20 cm)
  | 'wire_anchor'           // Sidreni ovjes (anker) s oprugom + žica s ušicom (15-100 cm)
  | 'nonius';               // Nonius ovjes za teška/protupožarna opterećenja

export type StudProfileType = 'CW_50' | 'CW_75' | 'CW_100' | 'CD_60_27';
export type TrackProfileType = 'UW_50' | 'UW_75' | 'UW_100' | 'UD_28_27';

export type BoardType = 'standard' | 'moisture_resistant' | 'fire_resistant' | 'acoustic_diamant';

export interface Opening {
  id: string;
  type: 'door' | 'window';
  name: string;
  wallIndex: number; // 0..N (Wall 1, Wall 2, etc.)
  distanceFromStart: number; // in cm
  width: number; // in cm (e.g. 90 cm)
  height: number; // in cm (e.g. 205 cm)
  sillHeight?: number; // in cm (for windows, e.g. 90 cm)
  useUAProfile?: boolean; // Za vrata (ojačanje dovratnika)
}

export interface PartitionWall {
  id: string;
  name: string;
  startX: number; // in cm
  startY: number; // in cm
  endX: number; // in cm
  endY: number; // in cm
  height: number; // in cm
  profileType: 'CW_50' | 'CW_75' | 'CW_100';
  layers: 1 | 2;
  hasInsulation: boolean;
  openings: Opening[];
}

export interface WallCorner {
  x: number; // cm
  y: number; // cm
}

export interface WallConfig {
  id: string;
  name: string;
  length: number; // in cm
  height: number; // in cm
  liningType: 'direct_cd' | 'freestanding_cw' | 'none';
  straightenOffset: number; // cm of adjustment/gap for non-square rooms
}

export interface RoomConfig {
  shape: RoomShapeType;
  // Rectangular basic
  length: number; // cm (Zid 1 & 3)
  width: number;  // cm (Zid 2 & 4)
  height: number; // cm (visina stropa)
  
  // Asymmetric corners (4 to 6 points) in cm
  corners: WallCorner[];
  
  // Construction preferences
  constructionMode: ConstructionMode;
  studSpacing: 600 | 400 | 625; // in mm (600 standard, 400 heavy/tile)
  studProfile: StudProfileType;
  trackProfile: TrackProfileType;
  profileLengthMeters: 2.6 | 3.0 | 4.0; // standard commercial lengths
  
  // Straightening option for asymmetric room
  enableStraightening: boolean;
  straightenWallDistance: number; // min clearance in cm (e.g., 3cm to 10cm)
  
  // Drywall Boards
  boardType: BoardType;
  boardLayers: 1 | 2;
  boardSize: '2000x1250' | '2600x1200' | '2500x1200'; // mm
  
  // Insulation
  hasInsulation: boolean;
  insulationType: 'mineral_wool_50' | 'mineral_wool_75' | 'mineral_wool_100' | 'rockwool_50';
  
  // Ceiling Detailed Configuration
  ceilingMode: CeilingMode;
  ceilingHangerType: CeilingHangerType;
  ceilingDropDistanceCm: number; // cm spuštanja stropa (npr. 15, 20, 30 cm)
  ceilingPrimarySpacing: 900 | 1000 | 800; // mm razmak primarnih CD profila
  ceilingSecondarySpacing: 400 | 500; // mm razmak montažnih CD profila
  ceilingHangerSpacing: 800 | 900 | 1000; // mm razmak ovjesa
  ceilingBoardLayers: 1 | 2;
  ceilingHasInsulation: boolean;
  ceilingInsulationThickness: 50 | 100;
  
  // Openings on outer walls
  openings: Opening[];
  
  // Internal partition walls
  partitionWalls: PartitionWall[];
}

export interface MaterialItem {
  id: string;
  category: 'profiles' | 'hangers_connectors' | 'fasteners' | 'boards' | 'insulation' | 'finishing';
  name: string;
  code: string;
  unit: string;
  exactQuantity: number;
  packageSize: number;
  packageUnit: string;
  packagesNeeded: number;
  unitPrice: number; // in EUR
  totalPrice: number; // in EUR
  description: string;
  formulaNote: string;
}

export interface BoardSurfaceBreakdown {
  surfaceName: string;
  lengthM: number;
  heightM: number;
  areaGrossM2: number;
  openingsAreaM2: number;
  areaNetM2: number;
  layers: number;
  totalBoardAreaM2: number; // areaNet * layers * 1.08 waste
  fullBoardsCount: number; // cijele ploče bez rezanja
  cutPiecesCount: number; // rezani komadi
  boardsUsedCount: number; // ukupno cijelih ploča utrošeno za ovu površinu
  cutsSummary: string[]; // npr. ["Visinski doštuk na 40cm", "Završni rez širine (95cm)", "L-rez oko vrata"]
}

export interface BoardCalculationDetails {
  singleBoardWidthCm: number;
  singleBoardLengthCm: number;
  singleBoardAreaM2: number;
  totalFullBoardsCount: number; // Cijele ploče (puni format bez rezanja)
  totalCutBoardsCount: number; // Ploče koje se moraju rezati / doštukavati
  totalBoardsCount: number; // Ukupan broj cijelih ploča za narudžbu (komada)
  totalCutsEstimated: number; // Procijenjeni ukupan broj rezova
  utilizationRatePercent: number; // Postotak iskoristivosti
  wastePercent: number; // Postotak otpada
  wasteAreaM2: number; // m² otpada
  surfaces: BoardSurfaceBreakdown[];
}

export interface InsulationSurfaceBreakdown {
  surfaceName: string;
  lengthM: number;
  heightM: number;
  areaGrossM2: number;
  openingsAreaM2: number;
  areaNetM2: number; // exactly deducting doors & windows!
  packagesNeeded: number;
  piecesSummary: string[];
}

export interface InsulationCalculationDetails {
  totalGrossAreaM2: number;
  totalOpeningsAreaM2: number;
  totalNetInsulationAreaM2: number;
  totalPackagesNeeded: number;
  singlePackageAreaM2: number;
  surfaces: InsulationSurfaceBreakdown[];
}

export interface PartitionOpeningConflict {
  partitionId: string;
  partitionName: string;
  openingId: string;
  openingName: string;
  openingType: 'door' | 'window';
  wallIndex: number;
  wallName: string;
  distanceCm: number;
  isDirectOverlap: boolean;
  message: string;
  conflictPoint: { x: number; y: number };
}

export interface SubRoomInfo {
  id: string;
  name: string;
  areaM2: number;
  perimeterM: number;
  corners: WallCorner[];
  centroid: { x: number; y: number };
  openingsCount: { doors: number; windows: number };
  openings: Opening[];
  hasEntryDoor: boolean;
  hasWindow: boolean;
}

export interface CalculatedSummary {
  totalWallAreaGross: number; // m²
  totalOpeningsArea: number;  // m²
  totalWallAreaNet: number;    // m²
  totalCeilingArea: number;    // m²
  totalBoardAreaNeeded: number;// m² (including layers and 8% waste)
  totalPerimeter: number;      // m
  isAsymmetrical: boolean;
  maxAngleDeviationDeg: number;
  squareCorrectionVolumeLost: number; // m² floor area reduced to achieve true 90°
  
  // Board details & cutting plan
  boardCalculation: BoardCalculationDetails;

  // Insulation details & calculation around openings
  insulationCalculation?: InsulationCalculationDetails;

  // Count of elements
  totalStudsCount: number;
  totalTracksLengthM: number;
  totalOpeningsCount: number;
  totalPartitionsLengthM: number;
  
  // BOM items
  items: MaterialItem[];
  
  // Financials
  netTotalCost: number;
  vatRate: number; // 0.25 (25%)
  vatAmount: number;
  grandTotalCost: number;
  
  // Recommendations
  recommendations: string[];
}

