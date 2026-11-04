import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { RoomConfig, Opening, PartitionWall } from '../types';
import { 
  analyzeWallSegments, 
  computeStraightenedBounds, 
  calculateStudLocations,
  isPointInPolygon,
  clipLineToPolygon 
} from '../utils/geometry';
import { StandardBadge } from './KnaufGuideModal';
import { 
  Layers, 
  Eye, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Compass, 
  Sparkles, 
  ZoomIn, 
  ZoomOut,
  ShieldAlert,
  Flame,
  Droplets,
  Volume2,
  Grid,
  Hash,
  Info,
  CheckCircle2,
  Wrench,
  HelpCircle,
  X
} from 'lucide-react';

interface Room3DViewerProps {
  config: RoomConfig;
}

export interface InspectedElementInfo {
  name: string;
  type: string;
  category: 'stud' | 'track' | 'ceiling_cd' | 'ceiling_ud' | 'ua_heavy' | 'drywall_board' | 'insulation' | 'hanger' | 'connector' | 'tape' | 'masonry' | 'laser';
  standardKey?: string;
  profileCode?: string;
  dimensions?: string;
  role: string;
  rule: string;
}

export const Room3DViewer: React.FC<Room3DViewerProps> = ({ config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Layer visibility toggles (controlled cleanly outside the viewport)
  const [showMetalFrame, setShowMetalFrame] = useState(true);
  const [showInsulation, setShowInsulation] = useState(true);
  const [showDrywall, setShowDrywall] = useState(true);
  const [drywallOpacity, setDrywallOpacity] = useState(0.88);
  const [showBoardLabels, setShowBoardLabels] = useState(true);
  const [showCornerTapes, setShowCornerTapes] = useState(true); // Knauf Dallas / Alux corner tapes
  const [showOldCrookedWalls, setShowOldCrookedWalls] = useState(true);
  const [showLaserGuides, setShowLaserGuides] = useState(true);
  const [showCeilingFrame, setShowCeilingFrame] = useState(config.ceilingMode !== 'none'); // Ceiling CD/UD frame & hangers
  const [showCeilingBoards, setShowCeilingBoards] = useState(false); // Default false or transparent so ceiling profiles are immediately visible
  const [ceilingBoardsOpacity, setCeilingBoardsOpacity] = useState(0.35); // Semi-transparent for see-through
  const [showCeilingSlab, setShowCeilingSlab] = useState(false); // Concrete slab top cover toggle (default false/transparent)
  const [ceilingSlabOpacity, setCeilingSlabOpacity] = useState(0.18); // Semi-transparent when enabled
  const [explodedSpacing, setExplodedSpacing] = useState(0); // 0 = closed, 0 to 1 = exploded
  const [viewPreset, setViewPreset] = useState<'iso' | 'top' | 'front' | 'inside'>('iso');

  // Currently inspected / clicked 3D element
  const [inspectedElement, setInspectedElement] = useState<InspectedElementInfo | null>({
    name: 'Knauf CW 50/50 Zidni Vertikalni Profil',
    type: 'cw_stud',
    category: 'stud',
    standardKey: 'DIN_18182_1',
    profileCode: 'CW 50/50 × 0.6mm',
    dimensions: '50 × 50 × 2600 mm',
    role: 'Okomiti nosivi profil pregradnog zida i zidnih obloga. Preuzima vlačna i tlačna naprezanja.',
    rule: 'Reže se 1.5 cm kraće od visine stropa i samo ulaže u UW vodilice bez vijčanja (kako bi konstrukcija mogla elastično disati).'
  });

  // Stats on total 3D generated boards
  const [boardStats, setBoardStats] = useState({ wallBoards: 0, ceilingBoards: 0, total: 0 });

  // Internal Three.js state stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isRightDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.3, 0));
  const cameraSphericalRef = useRef({ radius: 8, theta: Math.PI / 4, phi: Math.PI / 3.5 });

  // Texture Cache to avoid recreating canvas textures repeatedly
  const textureCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

  // Clickable interactive mesh objects collection for raycasting
  const interactiveMeshesRef = useRef<THREE.Mesh[]>([]);
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const originalMeshMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null);

  // Update ceiling toggle when config changes
  useEffect(() => {
    setShowCeilingFrame(config.ceilingMode !== 'none');
  }, [config.ceilingMode]);

  // ================= 1. PROCEDURAL REALISTIC TEXTURES GENERATOR =================

  // Galvanized Zinc Steel Texture (Pocinčani čelik s cink-kristalima i rebrima)
  const getGalvanizedSteelTexture = () => {
    const key = 'galvanized_steel_zinc_spangle';
    if (textureCacheRef.current.has(key)) {
      return textureCacheRef.current.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Base zinc steel tone
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(0, 0, 512, 512);

      // Micro zinc spangle flecks (kristalna cink struktura)
      for (let i = 0; i < 2400; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 5 + 1;
        const shade = Math.floor(Math.random() * 60) + 180;
        ctx.fillStyle = `rgba(${shade}, ${shade + 5}, ${shade + 10}, ${Math.random() * 0.4 + 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Longitudinal rolling stiffener lines & ribs
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 3;
      for (let y = 30; y < 512; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      // Knauf embossed brand stamp
      ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KNAUF • DIN 18182 • 0.6mm', 256, 128);
      ctx.fillText('KNAUF • DIN 18182 • 0.6mm', 256, 384);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    textureCacheRef.current.set(key, texture);
    return texture;
  };

  // Mineral Wool Fibrous Texture (Staklena/Kamena mineralna vuna)
  const getMineralWoolTexture = () => {
    const key = 'mineral_wool_fibrous';
    if (textureCacheRef.current.has(key)) {
      return textureCacheRef.current.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Golden yellow wool base
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(0, 0, 512, 512);

      // Fibrous swirling strands
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 1800; i++) {
        const x1 = Math.random() * 512;
        const y1 = Math.random() * 512;
        const len = Math.random() * 30 + 10;
        const angle = Math.random() * Math.PI * 2;
        const x2 = x1 + Math.cos(angle) * len;
        const y2 = y1 + Math.sin(angle) * len;

        ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(202, 138, 4, 0.45)' : 'rgba(254, 240, 138, 0.55)';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Density clusters
      for (let i = 0; i < 400; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        const r = Math.random() * 12 + 4;
        ctx.fillStyle = 'rgba(180, 83, 9, 0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    textureCacheRef.current.set(key, texture);
    return texture;
  };

  // Drywall Board Texture with HRAK Chamfer & Screw Fastener Markers
  const getBoardTexture = (
    label: string, 
    widthM: number, 
    heightM: number, 
    boardType: string, 
    isCut: boolean, 
    layerIdx: number
  ) => {
    const key = `${label}_${widthM.toFixed(2)}x${heightM.toFixed(2)}_${boardType}_${isCut}_L${layerIdx}_${showBoardLabels}`;
    if (textureCacheRef.current.has(key)) {
      return textureCacheRef.current.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.max(256, Math.min(1024, Math.round(512 * (heightM / widthM))));
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Authentic plasterboard cardboard face tone
      let bg = '#F8FAFC'; // Standard White GKB
      let borderCol = '#94A3B8';
      let edgeTint = '#E2E8F0';

      if (boardType === 'moisture_resistant') {
        bg = isCut ? '#A7F3D0' : '#86EFAC'; // Green GKBI
        borderCol = '#059669';
        edgeTint = '#6EE7B7';
      } else if (boardType === 'fire_resistant') {
        bg = isCut ? '#FECDD3' : '#FDA4AF'; // Red/Pink GKF
        borderCol = '#E11D48';
        edgeTint = '#F43F5E';
      } else if (boardType === 'acoustic_diamant') {
        bg = isCut ? '#BFDBFE' : '#93C5FD'; // Blue Diamant
        borderCol = '#2563EB';
        edgeTint = '#3B82F6';
      }

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Fine gypsum cardboard micro-grain
      ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
      for (let g = 0; g < 400; g++) {
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
      }

      // Screws dotted guidelines (every 25cm vertically)
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 16]);
      [30, canvas.width / 2, canvas.width - 30].forEach(lx => {
        ctx.beginPath();
        ctx.moveTo(lx, 20);
        ctx.lineTo(lx, canvas.height - 20);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Knauf HRAK / AK edge chamfer border
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

      // Inner bevel highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

      // Number badge / dimension stamp in center
      if (showBoardLabels) {
        const badgeW = Math.min(canvas.width * 0.85, 340);
        const badgeH = 72;
        const bx = (canvas.width - badgeW) / 2;
        const by = (canvas.height - badgeH) / 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 8);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Main Board Identifier
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, canvas.width / 2, by + 24);

        // Dimensions & format text
        ctx.fillStyle = isCut ? '#FBBF24' : '#60A5FA';
        ctx.font = 'bold 15px sans-serif';
        const dimStr = `${Math.round(widthM * 100)} × ${Math.round(heightM * 100)} cm • ${isCut ? 'REZANA' : 'CIJELI FORMAT'}`;
        ctx.fillText(dimStr, canvas.width / 2, by + 50);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    textureCacheRef.current.set(key, texture);
    return texture;
  };

  // ================= 2. THREE.JS SCENE ASSEMBLY =================

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 520;

    // Reset interactive meshes registry
    interactiveMeshesRef.current = [];

    // 1. Initialize Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0f1d); // Ultra-deep Slate 950 clean studio backdrop

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 2. Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(12, 20, 14);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.6);
    dirLight2.position.set(-12, 12, -12);
    scene.add(dirLight2);

    const pointFill = new THREE.PointLight(0x38bdf8, 0.35, 15);
    pointFill.position.set(0, 1.5, 0);
    scene.add(pointFill);

    // 3. Materials with Realistic Textures
    const metalTexture = getGalvanizedSteelTexture();
    const woolTexture = getMineralWoolTexture();

    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      map: metalTexture,
      metalness: 0.85,
      roughness: 0.28,
      side: THREE.DoubleSide,
    });

    const uaMaterial = new THREE.MeshStandardMaterial({
      color: 0x2563eb, // Royal blue accent for heavy duty UA profiles
      metalness: 0.8,
      roughness: 0.25,
    });

    const tapeMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155, // Charcoal PE acoustic foam tape
      roughness: 0.95,
    });

    const woolMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      map: woolTexture,
      roughness: 0.95,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });

    const oldWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      transparent: true,
      opacity: 0.4,
    });

    const concreteSlabMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      transparent: true,
      opacity: ceilingSlabOpacity,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevents z-fighting and occlusion of interior ceiling profiles
    });

    // Helper to register interactive mesh
    const registerInteractiveMesh = (mesh: THREE.Mesh, info: InspectedElementInfo) => {
      mesh.userData = info;
      interactiveMeshesRef.current.push(mesh);
    };

    // 4. Geometry coordinates (Convert cm to meters for 3D scale)
    const straightened = computeStraightenedBounds(config.corners, config.straightenWallDistance || 5);
    const wallHeightM = config.height / 100;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    config.corners.forEach(c => {
      minX = Math.min(minX, c.x / 100);
      maxX = Math.max(maxX, c.x / 100);
      minZ = Math.min(minZ, c.y / 100);
      maxZ = Math.max(maxZ, c.y / 100);
    });
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    cameraTargetRef.current.set(0, wallHeightM / 2, 0);

    const floorSizeX = (maxX - minX) + 2.0;
    const floorSizeZ = (maxZ - minZ) + 2.0;

    // Floor Grid
    const gridHelper = new THREE.GridHelper(Math.max(floorSizeX, floorSizeZ), 20, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.005;
    scene.add(gridHelper);

    // Floor base slab
    const floorGeo = new THREE.PlaneGeometry(floorSizeX, floorSizeZ);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.01;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Ceiling Concrete Slab at top (Transparent & Togglable so profiles remain visible from above)
    if (showCeilingSlab && config.ceilingMode !== 'none') {
      const slabGeo = new THREE.BoxGeometry(floorSizeX, 0.08, floorSizeZ);
      const slabMesh = new THREE.Mesh(slabGeo, concreteSlabMaterial);
      slabMesh.position.set(0, wallHeightM + 0.04, 0);
      registerInteractiveMesh(slabMesh, {
        name: 'Masivni Betonski Strop (Transparentna nosiva ploča)',
        type: 'concrete_slab',
        category: 'masonry',
        role: 'Nosiva međukatna betonska konstrukcija u koju se sidre stropni ovjesi i klinovi DN6.',
        rule: 'Sidri se isključivo metalnim čeličnim klinovima (plastične tiple su zabranjene).'
      });
      scene.add(slabMesh);
    }

    // 5. RENDER CROOKED OLD WALLS (if asymmetric & toggled)
    if (showOldCrookedWalls && straightened.deviationsDeg.some(d => d > 0.5)) {
      const oldWallGroup = new THREE.Group();
      const oldWallExplode = explodedSpacing * 0.45;

      for (let i = 0; i < config.corners.length; i++) {
        const p1 = config.corners[i];
        const p2 = config.corners[(i + 1) % config.corners.length];
        
        const x1 = p1.x / 100 - centerX;
        const z1 = p1.y / 100 - centerZ;
        const x2 = p2.x / 100 - centerX;
        const z2 = p2.y / 100 - centerZ;
        
        const len = Math.hypot(x2 - x1, z2 - z1);
        const angle = Math.atan2(z2 - z1, x2 - x1);
        
        const nx = -Math.sin(angle);
        const nz = Math.cos(angle);

        const wallGeo = new THREE.BoxGeometry(len, wallHeightM, 0.15);
        const wallMesh = new THREE.Mesh(wallGeo, oldWallMaterial);
        wallMesh.position.set(
          (x1 + x2) / 2 - nx * oldWallExplode, 
          wallHeightM / 2, 
          (z1 + z2) / 2 - nz * oldWallExplode
        );
        wallMesh.rotation.y = -angle;
        registerInteractiveMesh(wallMesh, {
          name: `Stari Zid Z${i + 1} (Neravni masivni zid)`,
          type: 'old_wall',
          category: 'masonry',
          dimensions: `Duljina: ${(len * 100).toFixed(0)} cm, Visina: ${(wallHeightM * 100).toFixed(0)} cm`,
          role: 'Postojeći zid s kutnim odstupanjem. Samostojeći predzid W625 ga izravnava bez sidrenja.',
          rule: 'Laserska ortogonalna linija omogućuje postavljanje nove suhe obloge pod 90.0°.'
        });
        oldWallGroup.add(wallMesh);
      }
      scene.add(oldWallGroup);
    }

    // 6. RENDER METAL POTKONSTRUKCIJA & FRAMING
    const useInscribedFrame = config.shape === 'asymmetric'
      ? (config.constructionMode === 'freestanding_lining' || config.enableStraightening)
      : config.enableStraightening;

    const frameCorners = useInscribedFrame
      ? straightened.squaredCorners
      : config.corners;

    const frameSegments = analyzeWallSegments(frameCorners);
    const metalGroup = new THREE.Group();
    const insulationGroup = new THREE.Group();
    const drywallGroup = new THREE.Group();
    const laserGroup = new THREE.Group();
    const cornerTapeGroup = new THREE.Group();

    // Profile dimensions in meters
    const studWidth = 0.05;
    const studDepth = config.studProfile.includes('100') ? 0.10 : config.studProfile.includes('75') ? 0.075 : 0.05;
    const trackHeight = 0.04;

    // Board standard size
    let stdBoardWidthM = 1.25;
    let stdBoardLengthM = 2.00;
    if (config.boardSize === '2600x1200') {
      stdBoardWidthM = 1.20;
      stdBoardLengthM = 2.60;
    } else if (config.boardSize === '2500x1200') {
      stdBoardWidthM = 1.20;
      stdBoardLengthM = 2.50;
    }

    let globalWallBoardCounter = 0;
    let globalCeilingBoardCounter = 0;

    // Helper: 2D rectangle boolean subtraction for realistic drywall cuts around doors and windows
    interface WallSubRect {
      x: number; // m
      y: number; // m
      w: number; // m
      h: number; // m
    }

    const subtractOpeningObstacles = (candidate: WallSubRect, obstacles: WallSubRect[]): WallSubRect[] => {
      let pieces: WallSubRect[] = [candidate];

      for (const obs of obstacles) {
        const nextPieces: WallSubRect[] = [];
        for (const p of pieces) {
          const px2 = p.x + p.w;
          const py2 = p.y + p.h;
          const ox2 = obs.x + obs.w;
          const oy2 = obs.y + obs.h;

          const interX1 = Math.max(p.x, obs.x);
          const interY1 = Math.max(p.y, obs.y);
          const interX2 = Math.min(px2, ox2);
          const interY2 = Math.min(py2, oy2);

          if (interX1 < interX2 - 0.005 && interY1 < interY2 - 0.005) {
            // Left piece
            if (p.x < interX1 - 0.005) {
              nextPieces.push({ x: p.x, y: p.y, w: interX1 - p.x, h: p.h });
            }
            // Right piece
            if (px2 > interX2 + 0.005) {
              nextPieces.push({ x: interX2, y: p.y, w: px2 - interX2, h: p.h });
            }
            // Bottom piece (sill / parapet under window)
            if (p.y < interY1 - 0.005) {
              nextPieces.push({ x: interX1, y: p.y, w: interX2 - interX1, h: interY1 - p.y });
            }
            // Top piece (header above door / window)
            if (py2 > interY2 + 0.005) {
              nextPieces.push({ x: interX1, y: interY2, w: interX2 - interX1, h: py2 - interY2 });
            }
          } else {
            nextPieces.push(p);
          }
        }
        pieces = nextPieces;
      }

      return pieces.filter(p => p.w >= 0.02 && p.h >= 0.02);
    };

    // Helper to render individual rectangular drywall boards on a surface respecting openings
    const renderIndividualBoardsOnWall = (
      parentGroup: THREE.Group,
      wallLengthM: number,
      wallHeightM: number,
      layerIndex: 1 | 2,
      baseZOffset: number,
      openingsList: Opening[],
      wallLabelPrefix: string
    ) => {
      const boardThickness = 0.0125;
      const numCols = Math.ceil(wallLengthM / stdBoardWidthM);
      const layerStaggerOffset = (layerIndex === 2) ? (stdBoardWidthM / 2) : 0;

      // Extract opening obstacle rectangles in meters
      const obstacleRects: WallSubRect[] = (openingsList || []).map(op => ({
        x: Math.max(0, op.distanceFromStart / 100),
        y: Math.max(0, (op.sillHeight || 0) / 100),
        w: Math.max(0.1, op.width / 100),
        h: Math.max(0.1, op.height / 100),
      }));

      for (let col = 0; col < numCols; col++) {
        const colStartX = col * stdBoardWidthM + layerStaggerOffset;
        if (colStartX >= wallLengthM && layerIndex === 2) continue;

        const actualColWidth = Math.min(stdBoardWidthM, wallLengthM - colStartX);
        if (actualColWidth <= 0.02) continue;

        const isStaggeredCol = (col % 2 === 1);
        const firstBoardHM = (isStaggeredCol && wallHeightM > stdBoardLengthM)
          ? Math.min(wallHeightM, Math.max(0.6, stdBoardLengthM * 0.6))
          : Math.min(wallHeightM, stdBoardLengthM);

        let currentY = 0;
        let pieceInColIdx = 0;

        while (currentY < wallHeightM - 0.01) {
          const pieceHM = Math.min(
            (pieceInColIdx === 0 ? firstBoardHM : stdBoardLengthM),
            wallHeightM - currentY
          );

          if (pieceHM <= 0.02) break;

          // Subtract openings from this tile
          const candidateTile: WallSubRect = {
            x: colStartX,
            y: currentY,
            w: actualColWidth,
            h: pieceHM,
          };

          const validPieces = subtractOpeningObstacles(candidateTile, obstacleRects);

          validPieces.forEach(piece => {
            globalWallBoardCounter++;
            const boardTag = `#${wallLabelPrefix}${globalWallBoardCounter}`;
            const isCut = (piece.w < stdBoardWidthM - 0.02) || (piece.h < stdBoardLengthM - 0.02);

            const bGeo = new THREE.BoxGeometry(
              Math.max(0.01, piece.w - 0.003),
              Math.max(0.01, piece.h - 0.003),
              boardThickness
            );

            const bTex = getBoardTexture(
              boardTag,
              piece.w,
              piece.h,
              config.boardType,
              isCut,
              layerIndex
            );

            const bMat = new THREE.MeshStandardMaterial({
              map: bTex,
              roughness: 0.7,
              transparent: drywallOpacity < 0.99,
              opacity: drywallOpacity,
              side: THREE.DoubleSide,
            });

            const bMesh = new THREE.Mesh(bGeo, bMat);
            bMesh.position.set(
              piece.x + piece.w / 2,
              piece.y + piece.h / 2,
              baseZOffset
            );
            bMesh.castShadow = true;

            const boardTypeName = config.boardType === 'moisture_resistant' 
              ? 'Knauf GKBI Impregnirana (Zelena)'
              : config.boardType === 'fire_resistant'
              ? 'Knauf GKF Protupožarna (Crvena)'
              : config.boardType === 'acoustic_diamant'
              ? 'Knauf Diamant Tvrda Zvučna (Plava)'
              : 'Knauf GKB Standardna (Bijela)';

            registerInteractiveMesh(bMesh, {
              name: `${boardTypeName} ${boardTag}`,
              type: 'drywall_board',
              category: 'drywall_board',
              standardKey: 'HRN_EN_520',
              dimensions: `${(piece.w * 100).toFixed(0)} × ${(piece.h * 100).toFixed(0)} cm (debljina 12.5mm)`,
              role: `Sloj ${layerIndex} gipsane obloge. ${isCut ? 'Rezana ploča (otvor/raster prilagođen)' : 'Puni tvornički format'}.`,
              rule: 'Vijča se TN vijcima na razmak max. 25 cm (1. sloj) ili 20 cm (2. sloj) s pomakom poprečnih fuga min. 40 cm.'
            });

            parentGroup.add(bMesh);
          });

          currentY += pieceHM;
          pieceInColIdx++;
        }
      }
    };

    // Helper to render mineral wool insulation on a wall cavity with exact cutout of doors and windows
    const renderInsulationOnWall = (
      parentGroup: THREE.Group,
      wallLengthM: number,
      wallHeightM: number,
      studDepthM: number,
      baseZOffset: number,
      openingsList: Opening[],
      wallLabelPrefix: string
    ) => {
      const standardBattWidthM = 0.60; // 60cm standard Knauf Insulation batt width
      const trackOffset = 0.04; // 40mm track allowance top and bottom
      const cavityHeightM = Math.max(0.1, wallHeightM - trackOffset * 2);
      const numCols = Math.ceil(wallLengthM / standardBattWidthM);

      // Extract opening obstacle rectangles in meters
      const obstacleRects: WallSubRect[] = (openingsList || []).map(op => ({
        x: Math.max(0, op.distanceFromStart / 100),
        y: Math.max(0, (op.sillHeight || 0) / 100),
        w: Math.max(0.05, op.width / 100),
        h: Math.max(0.05, op.height / 100),
      }));

      let pieceCounter = 0;

      for (let col = 0; col < numCols; col++) {
        const colStartX = col * standardBattWidthM;
        const actualColWidth = Math.min(standardBattWidthM, wallLengthM - colStartX);
        if (actualColWidth <= 0.02) continue;

        // Candidate tile for this CW stud bay
        const candidateTile: WallSubRect = {
          x: colStartX,
          y: trackOffset,
          w: actualColWidth,
          h: cavityHeightM,
        };

        const validPieces = subtractOpeningObstacles(candidateTile, obstacleRects);

        validPieces.forEach(piece => {
          pieceCounter++;
          const insPieceGeo = new THREE.BoxGeometry(
            Math.max(0.01, piece.w - 0.005),
            Math.max(0.01, piece.h - 0.005),
            studDepthM * 0.88
          );

          const insMesh = new THREE.Mesh(insPieceGeo, woolMaterial);
          insMesh.position.set(
            piece.x + piece.w / 2,
            piece.y + piece.h / 2,
            baseZOffset
          );

          const isHeader = piece.y >= (wallHeightM * 0.45) && obstacleRects.some(o => piece.x >= o.x - 0.1 && (piece.x + piece.w) <= (o.x + o.w + 0.1));
          const isSill = piece.y < 1.1 && obstacleRects.some(o => o.y > 0.3 && piece.x >= o.x - 0.1 && (piece.x + piece.w) <= (o.x + o.w + 0.1));

          const partDescription = isHeader 
            ? 'Nadvratni / Nadprozorni uložak vune'
            : isSill
            ? 'Parapetni uložak vune ispod prozora'
            : 'Puni raster mineralne vune između CW profila';

          registerInteractiveMesh(insMesh, {
            name: `Knauf Insulation Vuna (${(studDepthM * 1000).toFixed(0)} mm) #${wallLabelPrefix}${pieceCounter}`,
            type: 'mineral_wool',
            category: 'insulation',
            standardKey: 'HRN_EN_ISO_717_1',
            dimensions: `${(piece.w * 100).toFixed(0)} × ${(piece.h * 100).toFixed(0)} cm (debljina ${(studDepthM * 1000).toFixed(0)} mm)`,
            role: `${partDescription}. Točno skrojena oko otvora vrata/prozora bez zračnih džepova.`,
            rule: 'Ulaže se u šupljinu između CW vertikala sa stisnutim spojevima radi pune akustičke apsorpcije.'
          });

          parentGroup.add(insMesh);
        });
      }
    };

    // Render Each Wall Segment
    frameSegments.forEach((seg, segIdx) => {
      const x1 = seg.p1.x / 100 - centerX;
      const z1 = seg.p1.y / 100 - centerZ;
      const x2 = seg.p2.x / 100 - centerX;
      const z2 = seg.p2.y / 100 - centerZ;

      const wallLenM = seg.length / 100;
      const wallAngle = Math.atan2(z2 - z1, x2 - x1);

      const wallSubGroup = new THREE.Group();
      wallSubGroup.position.set(x1, 0, z1);
      wallSubGroup.rotation.y = -wallAngle;

      const wallOpenings = config.openings.filter(o => o.wallIndex === segIdx);
      const studLocations = calculateStudLocations(seg.length, config.studSpacing, wallOpenings);

      // Acoustic Tape under Bottom Track
      const tapeMesh = new THREE.Mesh(new THREE.BoxGeometry(wallLenM, 0.005, studDepth), tapeMaterial);
      tapeMesh.position.set(wallLenM / 2, 0.0025, 0);
      registerInteractiveMesh(tapeMesh, {
        name: 'Knauf Dichtungsband (PE Akustična Brtvena Traka)',
        type: 'acoustic_tape',
        category: 'tape',
        standardKey: 'HRN_EN_ISO_717_1',
        dimensions: `Širina: ${(studDepth * 1000).toFixed(0)} mm, Debljina: 3 mm`,
        role: 'Elastično brtvljenje spoja UW vodilice s podom i stropom radi sprječavanja bočnog prijenosa zvuka.',
        rule: 'Obavezna ugradnja na sve perimetralne profile prije tiplanja u podlogu.'
      });
      wallSubGroup.add(tapeMesh);

      // Bottom Track (UW / UD)
      const isCDLining = config.constructionMode === 'wall_lining_direct';
      const trackName = isCDLining ? 'Knauf UD 28/27' : `Knauf UW ${(studDepth * 1000).toFixed(0)}`;
      const bottomTrack = new THREE.Mesh(new THREE.BoxGeometry(wallLenM, trackHeight, studDepth), metalMaterial);
      bottomTrack.position.set(wallLenM / 2, trackHeight / 2, 0);
      registerInteractiveMesh(bottomTrack, {
        name: `${trackName} Podna Vodilica`,
        type: 'uw_track',
        category: 'track',
        standardKey: 'DIN_18182_1',
        dimensions: `Širina: ${(studDepth * 1000).toFixed(0)} mm, Visina: 40 mm, Duljina: ${(wallLenM * 100).toFixed(0)} cm`,
        role: 'Vodoravna vodilica koja fiksira poziciju zida na podu.',
        rule: 'Tipla se udarnim tiplama u pod svakih max. 80-100 cm s postavljenom PE trakom.'
      });
      wallSubGroup.add(bottomTrack);

      // Top Track (UW / UD)
      const topTrack = new THREE.Mesh(new THREE.BoxGeometry(wallLenM, trackHeight, studDepth), metalMaterial);
      topTrack.position.set(wallLenM / 2, wallHeightM - trackHeight / 2, 0);
      registerInteractiveMesh(topTrack, {
        name: `${trackName} Stropna Vodilica`,
        type: 'uw_track',
        category: 'track',
        standardKey: 'DIN_18182_1',
        dimensions: `Širina: ${(studDepth * 1000).toFixed(0)} mm, Visina: 40 mm`,
        role: 'Gornja vodilica pričvršćena na strop.',
        rule: 'U nju se ulažu CW vertikale bez fiksnog vijčanja (omogućuje rad stropa).'
      });
      wallSubGroup.add(topTrack);

      // Vertical Studs (CW / CD / UA)
      const hangerExplodeOffset = -explodedSpacing * 0.22;
      studLocations.forEach(stud => {
        const offsetM = stud.offsetCm / 100;
        const isUA = stud.type === 'door_jamb_ua';
        const isCorner = stud.type === 'corner';
        
        const currentStudWidth = isUA ? 0.06 : studWidth;
        const currentStudDepth = isUA ? studDepth + 0.01 : studDepth;
        const studHeight = wallHeightM - trackHeight * 2;

        const studMesh = new THREE.Mesh(
          new THREE.BoxGeometry(currentStudWidth, studHeight, currentStudDepth),
          isUA ? uaMaterial : metalMaterial
        );
        studMesh.position.set(offsetM, wallHeightM / 2, 0);
        studMesh.castShadow = true;

        if (isUA) {
          registerInteractiveMesh(studMesh, {
            name: `Knauf UA ${(currentStudDepth * 1000).toFixed(0)} Ojačani Profil za Dovratnik`,
            type: 'ua_profile',
            category: 'ua_heavy',
            standardKey: 'DIN_18182_1',
            profileCode: `UA ${(currentStudDepth * 1000).toFixed(0)} × 2.0mm`,
            dimensions: `60 × ${(studHeight * 100).toFixed(0)} × ${(currentStudDepth * 1000).toFixed(0)} mm (čelik 2.0mm)`,
            role: 'Ojačani profil za nošenje dovratnika vrata >25 kg ili širine >90 cm.',
            rule: 'Sidri se priključnim kutnicima i čeličnim tiplama M8 u armirani beton poda i stropa.'
          });
        } else {
          registerInteractiveMesh(studMesh, {
            name: `Knauf CW ${(studDepth * 1000).toFixed(0)} Zidna Vertikala`,
            type: 'cw_stud',
            category: 'stud',
            standardKey: 'DIN_18182_1',
            profileCode: `CW ${(studDepth * 1000).toFixed(0)} × 0.6mm`,
            dimensions: `50 × ${(studHeight * 100).toFixed(0)} × ${(studDepth * 1000).toFixed(0)} mm`,
            role: 'Glavni okomiti nosivi profil s H-otvorima za kabele.',
            rule: 'Reže se 1.5 cm kraće od stropa, ulaže u UW bez vijčanja.'
          });
        }

        wallSubGroup.add(studMesh);

        // If direct CD lining: add direct hangers
        if (config.constructionMode === 'wall_lining_direct' && !isCorner) {
          const hangerCount = Math.max(2, Math.ceil(wallHeightM / 0.85));
          for (let h = 1; h <= hangerCount; h++) {
            const hY = (h / (hangerCount + 1)) * wallHeightM;
            const hangerMesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.04, 0.03, 0.08), 
              metalMaterial
            );
            hangerMesh.position.set(
              offsetM, 
              hY, 
              -studDepth / 2 - 0.03 + hangerExplodeOffset
            );
            registerInteractiveMesh(hangerMesh, {
              name: 'Direktni Nosač CD 60/27 (Zidni nosač)',
              type: 'direct_hanger',
              category: 'hanger',
              standardKey: 'HRN_EN_13964',
              role: 'Krut nosač usidren u masivni zid koji drži vertikalu CD 60.',
              rule: 'Pričvršćuje se na CD profil LN vijcima 3.5×9.5 mm.'
            });
            wallSubGroup.add(hangerMesh);
          }
        }
      });

      // Headers (nadvratnici) and sills for openings
      wallOpenings.forEach(op => {
        const opLeftM = op.distanceFromStart / 100;
        const opWidthM = op.width / 100;
        const opHeightM = op.height / 100;
        const opSillM = (op.sillHeight || 0) / 100;

        const headerMesh = new THREE.Mesh(
          new THREE.BoxGeometry(opWidthM, trackHeight, studDepth), 
          metalMaterial
        );
        headerMesh.position.set(opLeftM + opWidthM / 2, opSillM + opHeightM + trackHeight / 2, 0);
        registerInteractiveMesh(headerMesh, {
          name: `Nadvratnik Otvora (${op.name})`,
          type: 'opening_header',
          category: 'track',
          standardKey: 'DIN_18181',
          dimensions: `Širina: ${(opWidthM * 100).toFixed(0)} cm`,
          role: 'Preokrenuti profil koji premošćuje otvor vrata ili prozora.',
          rule: 'Poprečni spoj gips ploče mora biti pomaknut minimalno 15 cm od vertikale dovratnika.'
        });
        wallSubGroup.add(headerMesh);

        // Cripple studs above header
        const crippleHeight = wallHeightM - (opSillM + opHeightM + trackHeight * 2);
        if (crippleHeight > 0.1) {
          const crippleCount = Math.max(1, Math.floor(opWidthM / (config.studSpacing / 1000)));
          for (let c = 1; c <= crippleCount; c++) {
            const cOffset = opLeftM + (c / (crippleCount + 1)) * opWidthM;
            const crippleMesh = new THREE.Mesh(
              new THREE.BoxGeometry(studWidth, crippleHeight, studDepth), 
              metalMaterial
            );
            crippleMesh.position.set(cOffset, opSillM + opHeightM + trackHeight + crippleHeight / 2, 0);
            registerInteractiveMesh(crippleMesh, {
              name: 'Kratki CW Profil (Crutch Stud) Iznad Vrata',
              type: 'crutch_stud',
              category: 'stud',
              standardKey: 'DIN_18181',
              role: 'Preuzima raster gipsanih ploča iznad otvora.',
              rule: 'Ne smije biti u istoj osi kao dovratnik (pomak min. 15 cm).'
            });
            wallSubGroup.add(crippleMesh);
          }
        }

        // Window Sill track if window
        if (op.type === 'window' && opSillM > 0.05) {
          const sillMesh = new THREE.Mesh(
            new THREE.BoxGeometry(opWidthM, trackHeight, studDepth), 
            metalMaterial
          );
          sillMesh.position.set(opLeftM + opWidthM / 2, opSillM - trackHeight / 2, 0);
          registerInteractiveMesh(sillMesh, {
            name: `Parapetni Nosač Prozora (${op.name})`,
            type: 'window_sill',
            category: 'track',
            role: 'Donja vodoravna vodilica prozorskog otvora.',
            rule: 'Ojačava donji rub prozora i prihvaća vertikalne kratke profile.'
          });
          wallSubGroup.add(sillMesh);

          const sillCrippleHeight = opSillM - trackHeight * 2;
          if (sillCrippleHeight > 0.1) {
            const cMesh = new THREE.Mesh(
              new THREE.BoxGeometry(studWidth, sillCrippleHeight, studDepth), 
              metalMaterial
            );
            cMesh.position.set(opLeftM + opWidthM / 2, trackHeight + sillCrippleHeight / 2, 0);
            wallSubGroup.add(cMesh);
          }
        }
      });

      metalGroup.add(wallSubGroup);

      // Insulation Batt mesh (Rendered around and between doors & windows)
      if (config.hasInsulation) {
        const insSubGroup = new THREE.Group();
        insSubGroup.position.set(x1, 0, z1);
        insSubGroup.rotation.y = -wallAngle;

        const insExplodeOffset = -explodedSpacing * 0.06;
        renderInsulationOnWall(
          insSubGroup,
          wallLenM,
          wallHeightM,
          studDepth,
          insExplodeOffset,
          wallOpenings,
          `Z${segIdx + 1}-`
        );
        insulationGroup.add(insSubGroup);
      }

      // Drywall Individual Boards (Layer 1 & Layer 2)
      if (showDrywall) {
        const dwSubGroup = new THREE.Group();
        dwSubGroup.position.set(x1, 0, z1);
        dwSubGroup.rotation.y = -wallAngle;

        const layer1Z = studDepth / 2 + 0.0125 / 2 + (explodedSpacing * 0.22);
        renderIndividualBoardsOnWall(
          dwSubGroup, 
          wallLenM, 
          wallHeightM, 
          1, 
          layer1Z, 
          wallOpenings, 
          `Z${segIdx + 1}-`
        );

        if (config.boardLayers === 2) {
          const layer2Z = studDepth / 2 + 0.0125 + 0.0125 / 2 + (explodedSpacing * 0.50);
          renderIndividualBoardsOnWall(
            dwSubGroup, 
            wallLenM, 
            wallHeightM, 
            2, 
            layer2Z, 
            wallOpenings, 
            `Z${segIdx + 1}.2-`
          );
        }

        drywallGroup.add(dwSubGroup);
      }

      // Laser guide line
      if (showLaserGuides && config.enableStraightening && config.shape === 'asymmetric') {
        const laserMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
        const laserPoints = [
          new THREE.Vector3(x1, 0.05, z1),
          new THREE.Vector3(x2, 0.05, z2),
          new THREE.Vector3(x2, wallHeightM - 0.05, z2),
          new THREE.Vector3(x1, wallHeightM - 0.05, z1),
          new THREE.Vector3(x1, 0.05, z1),
        ];
        const laserLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(laserPoints), laserMat);
        laserGroup.add(laserLine);
      }
    });

    // 6B. RENDER KNAUF DALLAS / ALUX CORNER TAPES AT ALL VERTEX JUNCTIONS
    if (showCornerTapes) {
      const numCorners = frameCorners.length;
      for (let cIdx = 0; cIdx < numCorners; cIdx++) {
        const prevP = frameCorners[(cIdx - 1 + numCorners) % numCorners];
        const currP = frameCorners[cIdx];
        const nextP = frameCorners[(cIdx + 1) % numCorners];

        const cx = currP.x / 100 - centerX;
        const cz = currP.y / 100 - centerZ;

        // Calculate vertex internal angle
        const dx1 = prevP.x - currP.x;
        const dy1 = prevP.y - currP.y;
        const dx2 = nextP.x - currP.x;
        const dy2 = nextP.y - currP.y;

        let dot = (dx1 * dx2 + dy1 * dy2) / (Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2) || 1);
        dot = Math.max(-1, Math.min(1, dot));
        const angleDeg = Math.round((Math.acos(dot) * 180) / Math.PI * 10) / 10;
        const isCrooked = Math.abs(angleDeg - 90) > 1.5;

        // Create 3D flexible tape profile running along vertical corner
        const tapeWidthM = 0.05; // 50mm tape width
        const tapeThicknessM = 0.004; // 4mm thickness

        // Bright amber/orange for flexible composite tape (Knauf Dallas / Alux)
        const tapeColor = isCrooked ? 0xf59e0b : 0x0284c7;
        const cornerTapeMat = new THREE.MeshStandardMaterial({
          color: tapeColor,
          roughness: 0.4,
          metalness: 0.2,
          side: THREE.DoubleSide,
        });

        // Corner angle normal bisector
        const v1 = new THREE.Vector2(dx1, dy1).normalize();
        const v2 = new THREE.Vector2(dx2, dy2).normalize();
        const bisector = new THREE.Vector2().addVectors(v1, v2).normalize();

        const tapeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(tapeWidthM, wallHeightM, tapeThicknessM),
          cornerTapeMat
        );
        tapeMesh.position.set(cx + bisector.x * 0.03, wallHeightM / 2, cz + bisector.y * 0.03);
        tapeMesh.rotation.y = -Math.atan2(bisector.y, bisector.x);

        registerInteractiveMesh(tapeMesh, {
          name: isCrooked
            ? `Knauf Dallas Fleksibilna Kutna Traka (Kut ${angleDeg}°)`
            : `Knauf Alux Kutna Traka (Kut 90°)`,
          type: 'corner_tape',
          category: 'tape',
          standardKey: 'HRN_EN_13963',
          dimensions: `Duljina: ${(wallHeightM * 100).toFixed(0)} cm, Širina: 50 mm (Kut ${angleDeg}°)`,
          role: isCrooked
            ? `Kompozitna savitljiva traka za armiranje tupih/šiljastih kuteva (${angleDeg}°). Omogućuje savršenu obradu kuta bez pucanja mase.`
            : 'Armaturna kutna traka za ojačanje i precizno gletanje standardnih pravih kuteva.',
          rule: 'Utiskuje se u sloj Knauf Uniflott mase i zaglađuje kutnim gleterom.'
        });

        cornerTapeGroup.add(tapeMesh);
      }
    }

    // 7. RENDER INTERNAL PARTITION WALLS (Pregradni zidovi W111 / W112)
    config.partitionWalls.forEach((p, pIdx) => {
      const px1 = p.startX / 100 - centerX;
      const pz1 = p.startY / 100 - centerZ;
      const px2 = p.endX / 100 - centerX;
      const pz2 = p.endY / 100 - centerZ;
      
      const pLenM = Math.hypot(px2 - px1, pz2 - pz1);
      if (pLenM <= 0.05) return;
      const pAngle = Math.atan2(pz2 - pz1, px2 - px1);
      const pHM = (p.height || config.height) / 100;
      const pStudDepth = p.profileType === 'CW_100' ? 0.10 : p.profileType === 'CW_75' ? 0.075 : 0.05;
      const partLayers = p.layers || config.boardLayers || 1;

      const pGroup = new THREE.Group();
      pGroup.position.set(px1, 0, pz1);
      pGroup.rotation.y = -pAngle;

      // Bottom Track (UW) - smartly split if there is a door in the partition wall
      const pDoors = (p.openings || []).filter(o => o.type === 'door');
      if (pDoors.length === 0) {
        const bTrack = new THREE.Mesh(new THREE.BoxGeometry(pLenM, trackHeight, pStudDepth), metalMaterial);
        bTrack.position.set(pLenM / 2, trackHeight / 2, 0);
        registerInteractiveMesh(bTrack, {
          name: `Knauf UW ${(pStudDepth * 1000).toFixed(0)} Podna Vodilica Pregrade (${p.name})`,
          type: 'uw_track',
          category: 'track',
          standardKey: 'DIN_18182_1',
          role: 'Podna vodilica unutarnjeg pregradnog zida.',
          rule: 'Postavlja se na PE akustičnu traku i tipla u pod svakih 50-80 cm.'
        });
        pGroup.add(bTrack);
      } else {
        // Cut floor track at door openings so there is no trip hazard on the floor
        let currentPosM = 0;
        const sortedDoors = [...pDoors].sort((a, b) => a.distanceFromStart - b.distanceFromStart);
        sortedDoors.forEach((door) => {
          const doorStartM = Math.max(0, door.distanceFromStart / 100);
          const doorEndM = Math.min(pLenM, (door.distanceFromStart + door.width) / 100);
          if (doorStartM > currentPosM + 0.02) {
            const segLen = doorStartM - currentPosM;
            const bTrackSeg = new THREE.Mesh(new THREE.BoxGeometry(segLen, trackHeight, pStudDepth), metalMaterial);
            bTrackSeg.position.set(currentPosM + segLen / 2, trackHeight / 2, 0);
            pGroup.add(bTrackSeg);
          }
          currentPosM = doorEndM;
        });
        if (currentPosM < pLenM - 0.02) {
          const segLen = pLenM - currentPosM;
          const bTrackSeg = new THREE.Mesh(new THREE.BoxGeometry(segLen, trackHeight, pStudDepth), metalMaterial);
          bTrackSeg.position.set(currentPosM + segLen / 2, trackHeight / 2, 0);
          pGroup.add(bTrackSeg);
        }
      }

      // Top Track (UW) along the ceiling
      const tTrack = new THREE.Mesh(new THREE.BoxGeometry(pLenM, trackHeight, pStudDepth), metalMaterial);
      tTrack.position.set(pLenM / 2, pHM - trackHeight / 2, 0);
      registerInteractiveMesh(tTrack, {
        name: `Knauf UW ${(pStudDepth * 1000).toFixed(0)} Stropna Vodilica Pregrade (${p.name})`,
        type: 'uw_track',
        category: 'track',
        standardKey: 'DIN_18182_1',
        role: 'Stropna vodilica unutarnjeg pregradnog zida.',
        rule: 'Tipla se u stropnu konstrukciju s PE akustičnom trakom.'
      });
      pGroup.add(tTrack);

      // Acoustic Tape on Partition Base and Top
      const pTapeBase = new THREE.Mesh(new THREE.BoxGeometry(pLenM, 0.004, pStudDepth), tapeMaterial);
      pTapeBase.position.set(pLenM / 2, 0.002, 0);
      pGroup.add(pTapeBase);

      // Vertical Studs along partition wall
      const pStudLocs = calculateStudLocations(pLenM * 100, config.studSpacing, p.openings || []);
      pStudLocs.forEach(stud => {
        const offsetM = stud.offsetCm / 100;
        const isUA = stud.type === 'door_jamb_ua';
        const sMesh = new THREE.Mesh(
          new THREE.BoxGeometry(isUA ? 0.06 : studWidth, pHM - trackHeight * 2, pStudDepth),
          isUA ? uaMaterial : metalMaterial
        );
        sMesh.position.set(offsetM, pHM / 2, 0);
        registerInteractiveMesh(sMesh, {
          name: isUA ? `Knauf UA ${(pStudDepth * 1000).toFixed(0)} Ojačani Dovratnik Pregrade` : `Knauf CW ${(pStudDepth * 1000).toFixed(0)} Vertikala Pregrade`,
          type: isUA ? 'ua_profile' : 'cw_stud',
          category: isUA ? 'ua_heavy' : 'stud',
          standardKey: 'DIN_18182_1',
          role: isUA ? 'Ojačani dovratnik za ugradnju sobnih vrata u pregradni zid.' : 'Vertikalni nosivi profil pregradnog zida W111/W112.',
          rule: 'Razmak postavljanja 600 mm (ili 400 mm kod 2 sloja / pločica).'
        });
        pGroup.add(sMesh);
      });

      // Headers and Cripple studs for partition doors
      (p.openings || []).forEach(op => {
        const opLeftM = op.distanceFromStart / 100;
        const opWidthM = op.width / 100;
        const opHeightM = op.height / 100;
        const opSillM = (op.sillHeight || 0) / 100;

        const headerMesh = new THREE.Mesh(
          new THREE.BoxGeometry(opWidthM, trackHeight, pStudDepth),
          metalMaterial
        );
        headerMesh.position.set(opLeftM + opWidthM / 2, opSillM + opHeightM + trackHeight / 2, 0);
        registerInteractiveMesh(headerMesh, {
          name: `Nadvratnik Vrata u Pregradi (${op.name})`,
          type: 'opening_header',
          category: 'track',
          standardKey: 'DIN_18181',
          role: 'Preokrenuti profil iznad sobnih vrata u pregradnom zidu.',
          rule: 'Poprečni spoj gips ploče mora biti smaknut min. 15 cm od vertikale dovratnika.'
        });
        pGroup.add(headerMesh);

        // Cripple stud above header up to ceiling track
        const crippleHeight = pHM - (opSillM + opHeightM + trackHeight * 2);
        if (crippleHeight > 0.1) {
          const crippleCount = Math.max(1, Math.floor(opWidthM / (config.studSpacing / 1000)));
          for (let c = 1; c <= crippleCount; c++) {
            const cOffset = opLeftM + (c / (crippleCount + 1)) * opWidthM;
            const crippleMesh = new THREE.Mesh(
              new THREE.BoxGeometry(studWidth, crippleHeight, pStudDepth),
              metalMaterial
            );
            crippleMesh.position.set(cOffset, opSillM + opHeightM + trackHeight + crippleHeight / 2, 0);
            pGroup.add(crippleMesh);
          }
        }
      });

      metalGroup.add(pGroup);

      // Partition Wall Mineral Wool Insulation (fitted around partition openings)
      if (config.hasInsulation && p.hasInsulation !== false) {
        const pInsGroup = new THREE.Group();
        pInsGroup.position.set(px1, 0, pz1);
        pInsGroup.rotation.y = -pAngle;

        renderInsulationOnWall(
          pInsGroup,
          pLenM,
          pHM,
          pStudDepth,
          0,
          p.openings || [],
          `P${pIdx + 1}-`
        );
        insulationGroup.add(pInsGroup);
      }

      if (showDrywall) {
        const pDwGroup = new THREE.Group();
        pDwGroup.position.set(px1, 0, pz1);
        pDwGroup.rotation.y = -pAngle;

        // Front Face - Layer 1
        const frontZ1 = pStudDepth / 2 + 0.0125 / 2 + (explodedSpacing * 0.25);
        renderIndividualBoardsOnWall(pDwGroup, pLenM, pHM, 1, frontZ1, p.openings || [], `P${pIdx + 1}F1-`);

        // Front Face - Layer 2 (if 2 layers)
        if (partLayers === 2) {
          const frontZ2 = pStudDepth / 2 + 0.0125 + 0.0125 / 2 + (explodedSpacing * 0.45);
          renderIndividualBoardsOnWall(pDwGroup, pLenM, pHM, 2, frontZ2, p.openings || [], `P${pIdx + 1}F2-`);
        }

        // Back Face - Layer 1
        const backZ1 = -pStudDepth / 2 - 0.0125 / 2 - (explodedSpacing * 0.25);
        renderIndividualBoardsOnWall(pDwGroup, pLenM, pHM, 1, backZ1, p.openings || [], `P${pIdx + 1}B1-`);

        // Back Face - Layer 2 (if 2 layers)
        if (partLayers === 2) {
          const backZ2 = -pStudDepth / 2 - 0.0125 - 0.0125 / 2 - (explodedSpacing * 0.45);
          renderIndividualBoardsOnWall(pDwGroup, pLenM, pHM, 2, backZ2, p.openings || [], `P${pIdx + 1}B2-`);
        }

        drywallGroup.add(pDwGroup);
      }
    });

    // 8. RENDER SUSPENDED CEILING SUBSTRUCTURE & INDIVIDUAL CEILING BOARDS
    if (config.ceilingMode !== 'none') {
      const ceilingGroup = new THREE.Group();
      const ceilingInsGroup = new THREE.Group();
      const ceilingDwGroup = new THREE.Group();

      const dropM = (config.ceilingDropDistanceCm || 15) / 100;
      const ceilingBaseY = wallHeightM - dropM;

      const primaryCDEplodeY = -explodedSpacing * 0.10;
      const secondaryCDEplodeY = -explodedSpacing * 0.22;
      const insCeilExplodeY = -explodedSpacing * 0.15;
      const board1CeilExplodeY = -explodedSpacing * 0.35;
      const board2CeilExplodeY = -explodedSpacing * 0.55;

      const roomSpanX = maxX - minX;
      const roomSpanZ = maxZ - minZ;

      // 2D polygon of room in centered meters: (X, Z)
      const roomPolygonM = frameCorners.map(c => ({
        x: c.x / 100 - centerX,
        y: c.y / 100 - centerZ,
      }));

      // A. Perimeter UD 28/27 profiles along all walls at ceiling height
      frameSegments.forEach(seg => {
        const sx1 = seg.p1.x / 100 - centerX;
        const sz1 = seg.p1.y / 100 - centerZ;
        const sx2 = seg.p2.x / 100 - centerX;
        const sz2 = seg.p2.y / 100 - centerZ;
        const sLen = seg.length / 100;
        const sAng = Math.atan2(sz2 - sz1, sx2 - sx1);

        const udMesh = new THREE.Mesh(new THREE.BoxGeometry(sLen, 0.027, 0.028), metalMaterial);
        udMesh.position.set((sx1 + sx2) / 2, ceilingBaseY, (sz1 + sz2) / 2);
        udMesh.rotation.y = -sAng;
        registerInteractiveMesh(udMesh, {
          name: 'Knauf UD 28/27 Obodni Stropni Profil',
          type: 'ud_ceiling_track',
          category: 'ceiling_ud',
          standardKey: 'HRN_EN_13964',
          dimensions: '28 × 27 mm, debljina lima 0.6 mm',
          role: 'Zidni profil koji definira visinu spuštenog stropa i vodi CD profile duž perimetra.',
          rule: 'Obavezna primjena brtvene trake i tiplanje u zid na svakih max. 80 cm.'
        });
        ceilingGroup.add(udMesh);
      });

      // B. Primary CD 60/27 Profiles (Glavni nosivi CD) - clipped to room polygon
      const primarySpacingM = (config.ceilingPrimarySpacing || 900) / 1000;
      const secondarySpacingM = (config.ceilingSecondarySpacing || 500) / 1000;
      const hangerSpacingM = (config.ceilingHangerSpacing || 800) / 1000;

      const numPrimaryRows = Math.max(2, Math.floor(roomSpanZ / primarySpacingM) + 1);
      const isDoubleCD = config.ceilingMode === 'double_cd';
      const primY = isDoubleCD ? (ceilingBaseY + 0.027 + primaryCDEplodeY) : (ceilingBaseY + primaryCDEplodeY);

      for (let r = 0; r <= numPrimaryRows; r++) {
        const curZ = (minZ - centerZ) + r * (roomSpanZ / numPrimaryRows);
        // Clip horizontal line across room polygon
        const clippedPrimarySegs = clipLineToPolygon(
          minX - centerX,
          curZ,
          maxX - centerX,
          curZ,
          roomPolygonM
        );

        clippedPrimarySegs.forEach(seg => {
          const segLen = seg.x2 - seg.x1;
          if (segLen <= 0.08) return;

          const cdPrimaryGeo = new THREE.BoxGeometry(segLen * 0.98, 0.027, 0.06);
          const cdPrimary = new THREE.Mesh(cdPrimaryGeo, metalMaterial);
          cdPrimary.position.set((seg.x1 + seg.x2) / 2, primY, curZ);
          registerInteractiveMesh(cdPrimary, {
            name: 'Knauf CD 60/27 Primarni Nosivi Profil (Gornja razina)',
            type: 'cd_primary_profile',
            category: 'ceiling_cd',
            standardKey: 'HRN_EN_13964',
            dimensions: '60 × 27 mm (debljina 0.6 mm)',
            role: 'Glavni profil spuštenog stropa D112 ovješen o stropnu betonsku ploču.',
            rule: 'Maksimalni razmak primarnih profila 900 mm; točke ovjesa na razmaku max. 800 mm.'
          });
          ceilingGroup.add(cdPrimary);

          // Hangers along this valid primary profile segment
          const numHangersOnSeg = Math.max(1, Math.floor(segLen / hangerSpacingM));
          for (let h = 0; h <= numHangersOnSeg; h++) {
            const curX = seg.x1 + 0.04 + (h * ((segLen - 0.08) / Math.max(1, numHangersOnSeg)));
            if (!isPointInPolygon(curX, curZ, roomPolygonM)) continue;

            const hangerHeight = Math.max(0.08, (wallHeightM - primY));

            if (config.ceilingHangerType === 'direct_hanger') {
              const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.065, hangerHeight, 0.03), metalMaterial);
              bracket.position.set(curX, primY + hangerHeight / 2, curZ);
              registerInteractiveMesh(bracket, {
                name: 'Direktni Nosač CD 60 (Direkthänger)',
                type: 'direct_ceiling_hanger',
                category: 'hanger',
                standardKey: 'HRN_EN_13964',
                role: 'Krut U-nosač za plitko spuštanje stropa (do 15-20 cm).',
                rule: 'Pričvršćuje se na CD profil LN 3.5×9.5 mm vijcima.'
              });
              ceilingGroup.add(bracket);
            } else if (config.ceilingHangerType === 'nonius') {
              const noniusMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, hangerHeight, 0.03), uaMaterial);
              noniusMesh.position.set(curX, primY + hangerHeight / 2, curZ);
              registerInteractiveMesh(noniusMesh, {
                name: 'Knauf Nonius Ovjes (Pojačana nosivost)',
                type: 'nonius_hanger',
                category: 'hanger',
                standardKey: 'HRN_EN_13964',
                role: 'Visokonoseći ovjes (do 40 kg po točki) za protupožarne i akustične stropove.',
                rule: 'Povezuje se Nonius osiguračem (iglicom).'
              });
              ceilingGroup.add(noniusMesh);
            } else {
              const wireGeo = new THREE.CylinderGeometry(0.003, 0.003, hangerHeight, 8);
              const wireMesh = new THREE.Mesh(wireGeo, metalMaterial);
              wireMesh.position.set(curX, primY + hangerHeight / 2, curZ);
              ceilingGroup.add(wireMesh);

              const clipGeo = new THREE.BoxGeometry(0.06, 0.03, 0.04);
              const clipMesh = new THREE.Mesh(clipGeo, metalMaterial);
              clipMesh.position.set(curX, primY + 0.015, curZ);
              registerInteractiveMesh(clipMesh, {
                name: 'Sidreni Ovjes s Oprugom (Ankerhängers)',
                type: 'anchor_spring_hanger',
                category: 'hanger',
                standardKey: 'HRN_EN_13964',
                role: 'Ovjes s brzim podešavanjem visine na žici s ušicom (nosivost do 25 kg po točki).',
                rule: 'Za spuštanje od 15 cm do 100 cm.'
              });
              ceilingGroup.add(clipMesh);
            }

            // Knauf Deckennagel DN6 steel ceiling anchor pin at top slab
            const pinGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8);
            const pinMesh = new THREE.Mesh(pinGeo, metalMaterial);
            pinMesh.position.set(curX, wallHeightM + 0.02, curZ);
            registerInteractiveMesh(pinMesh, {
              name: 'Čelični Stropni Klin DN6 (Deckennagel)',
              type: 'steel_ceiling_pin',
              category: 'connector',
              standardKey: 'HRN_EN_13964',
              role: 'Protupožarno čelično sidro za učvršćenje žice u armirani beton.',
              rule: 'Zabranjeno je koristiti plastične tiple za spuštene stropove!'
            });
            ceilingGroup.add(pinMesh);
          }
        });
      }

      // C. Secondary CD 60/27 Profiles (Montažni CD) - clipped to room polygon
      const numSecondaryCols = Math.max(3, Math.floor(roomSpanX / secondarySpacingM) + 1);
      const secY = ceilingBaseY + secondaryCDEplodeY;

      for (let c = 0; c <= numSecondaryCols; c++) {
        const curX = (minX - centerX) + c * (roomSpanX / numSecondaryCols);
        const clippedSecondarySegs = clipLineToPolygon(
          curX,
          minZ - centerZ,
          curX,
          maxZ - centerZ,
          roomPolygonM
        );

        clippedSecondarySegs.forEach(seg => {
          const segLen = seg.y2 - seg.y1;
          if (segLen <= 0.08) return;

          const cdSecondaryGeo = new THREE.BoxGeometry(0.06, 0.027, segLen * 0.98);
          const cdSecondary = new THREE.Mesh(cdSecondaryGeo, metalMaterial);
          cdSecondary.position.set(curX, secY, (seg.y1 + seg.y2) / 2);
          registerInteractiveMesh(cdSecondary, {
            name: 'Knauf CD 60/27 Montažni Stropni Profil (Donja razina)',
            type: 'cd_secondary_profile',
            category: 'ceiling_cd',
            standardKey: 'HRN_EN_13964',
            dimensions: '60 × 27 mm (debljina 0.6 mm)',
            role: 'Donji profil na koji se izravno vijčaju gipskartonske stropne ploče.',
            rule: 'Razmak postavljanja 500 mm (1 sloj gipsa) ili 400 mm (2 sloja / vlažni prostori).'
          });
          ceilingGroup.add(cdSecondary);

          // Cross Connectors (Kreuzverbinder) at intersections if double CD
          if (isDoubleCD) {
            for (let r = 0; r <= numPrimaryRows; r++) {
              const curZ = (minZ - centerZ) + r * (roomSpanZ / numPrimaryRows);
              if (curZ >= seg.y1 - 0.01 && curZ <= seg.y2 + 0.01 && isPointInPolygon(curX, curZ, roomPolygonM)) {
                const crossGeo = new THREE.BoxGeometry(0.07, 0.04, 0.07);
                const crossMesh = new THREE.Mesh(crossGeo, metalMaterial);
                crossMesh.position.set(curX, ceilingBaseY + 0.015 + secondaryCDEplodeY, curZ);
                registerInteractiveMesh(crossMesh, {
                  name: 'Križna Spojnica CD/CD (Kreuzverbinder)',
                  type: 'cross_connector',
                  category: 'connector',
                  standardKey: 'HRN_EN_13964',
                  role: 'Čvrsto spaja primarni nosivi i sekundarni montažni CD profil pod 90° u 2 razine.',
                  rule: 'Osigurava stabilnost Knauf D112 dvorazinske rešetke bez klimanja.'
                });
                ceilingGroup.add(crossMesh);
              }
            }
          }
        });
      }

      // D. Ceiling Mineral Wool Insulation - perfectly shaped to room polygon
      if (config.ceilingHasInsulation) {
        try {
          const ceilShape = new THREE.Shape();
          roomPolygonM.forEach((pt, idx) => {
            if (idx === 0) ceilShape.moveTo(pt.x, pt.y);
            else ceilShape.lineTo(pt.x, pt.y);
          });
          ceilShape.closePath();

          const ceilInsThickness = (config.ceilingInsulationThickness || 50) / 1000;
          const ceilInsGeo = new THREE.ExtrudeGeometry(ceilShape, {
            depth: ceilInsThickness,
            bevelEnabled: false,
          });

          const ceilInsMesh = new THREE.Mesh(ceilInsGeo, woolMaterial);
          ceilInsMesh.rotation.x = Math.PI / 2;
          ceilInsMesh.position.set(0, ceilingBaseY + 0.03 + ceilInsThickness + insCeilExplodeY, 0);
          registerInteractiveMesh(ceilInsMesh, {
            name: `Knauf Stropna Mineralna Vuna (${config.ceilingInsulationThickness || 50} mm)`,
            type: 'ceiling_mineral_wool',
            category: 'insulation',
            standardKey: 'HRN_EN_ISO_717_1',
            dimensions: `Debljina: ${config.ceilingInsulationThickness || 50} mm`,
            role: 'Toplinska i zvučna izolacija položena u stropni plenum.',
            rule: 'Sprječava rezonanciju šupljine i gubitke topline prema krovu/etaži iznad.'
          });
          ceilingInsGroup.add(ceilInsMesh);
        } catch (e) {
          // Fallback box
          const ceilInsGeo = new THREE.BoxGeometry(roomSpanX * 0.96, 0.05, roomSpanZ * 0.96);
          const ceilInsMesh = new THREE.Mesh(ceilInsGeo, woolMaterial);
          ceilInsMesh.position.set(0, ceilingBaseY + 0.06 + insCeilExplodeY, 0);
          ceilingInsGroup.add(ceilInsMesh);
        }
      }

      // E. Individual Ceiling Drywall Boards (With Transparency, Independent Toggle & Room Polygon Constraint)
      const ceilCols = Math.ceil(roomSpanX / stdBoardLengthM);
      const ceilRows = Math.ceil(roomSpanZ / stdBoardWidthM);

      for (let r = 0; r < ceilRows; r++) {
        const rowStartZ = (minZ - centerZ) + r * stdBoardWidthM;
        const actualRowW = Math.min(stdBoardWidthM, (maxZ - centerZ) - rowStartZ);
        if (actualRowW <= 0.02) continue;

        const isStaggeredRow = (r % 2 === 1);
        const rowOffset = isStaggeredRow ? (stdBoardLengthM / 2) : 0;

        for (let c = 0; c < ceilCols; c++) {
          const colStartX = (minX - centerX) + c * stdBoardLengthM - rowOffset;
          const actualPieceL = Math.min(stdBoardLengthM, (maxX - centerX) - Math.max((minX - centerX), colStartX));
          if (actualPieceL <= 0.05) continue;

          // Check if board piece center is inside the room polygon
          const midX = colStartX + actualPieceL / 2;
          const midZ = rowStartZ + actualRowW / 2;

          if (!isPointInPolygon(midX, midZ, roomPolygonM)) {
            continue; // Skip boards outside the room boundary
          }

          globalCeilingBoardCounter++;
          const boardTag = `#S${globalCeilingBoardCounter}`;
          const isCut = (actualPieceL < stdBoardLengthM - 0.02) || (actualRowW < stdBoardWidthM - 0.02);

          const bGeo = new THREE.BoxGeometry(
            Math.max(0.01, actualPieceL - 0.003),
            0.0125,
            Math.max(0.01, actualRowW - 0.003)
          );

          const bTex = getBoardTexture(
            boardTag,
            actualPieceL,
            actualRowW,
            config.boardType,
            isCut,
            1
          );

          const bMat = new THREE.MeshStandardMaterial({
            map: bTex,
            roughness: 0.7,
            transparent: true,
            opacity: ceilingBoardsOpacity,
            side: THREE.DoubleSide,
            depthWrite: ceilingBoardsOpacity > 0.85,
          });

          const bMesh = new THREE.Mesh(bGeo, bMat);
          bMesh.position.set(
            midX,
            ceilingBaseY - 0.0125 / 2 + board1CeilExplodeY,
            midZ
          );
          registerInteractiveMesh(bMesh, {
            name: `Knauf Stropna Gipskartonska Ploča ${boardTag}`,
            type: 'ceiling_board',
            category: 'drywall_board',
            standardKey: 'HRN_EN_520',
            dimensions: `${(actualPieceL * 100).toFixed(0)} × ${(actualRowW * 100).toFixed(0)} cm (12.5mm)`,
            role: 'Gipskartonska ploča montirana poprečno na montažne CD profile.',
            rule: 'Montira se s pomakom poprečnih fuga min. 40 cm. Vijčanje TN vijcima na svakih 17 cm na stropu.'
          });
          ceilingDwGroup.add(bMesh);

          if (config.ceilingBoardLayers === 2) {
            const bMesh2 = new THREE.Mesh(bGeo, bMat);
            bMesh2.position.set(
              midX,
              ceilingBaseY - 0.0125 - 0.0125 / 2 + board2CeilExplodeY,
              midZ
            );
            ceilingDwGroup.add(bMesh2);
          }
        }
      }

      if (showCeilingFrame) scene.add(ceilingGroup);
      if (config.ceilingHasInsulation && showInsulation) scene.add(ceilingInsGroup);
      if (showCeilingBoards) scene.add(ceilingDwGroup);
    }

    if (showMetalFrame) scene.add(metalGroup);
    if (showInsulation && config.hasInsulation) scene.add(insulationGroup);
    if (showDrywall) scene.add(drywallGroup);
    if (showLaserGuides) scene.add(laserGroup);
    if (showCornerTapes) scene.add(cornerTapeGroup);

    setBoardStats({
      wallBoards: globalWallBoardCounter,
      ceilingBoards: globalCeilingBoardCounter,
      total: globalWallBoardCounter + globalCeilingBoardCounter
    });

    // 9. Camera positioning function
    const updateCameraPosition = () => {
      const { radius, theta, phi } = cameraSphericalRef.current;
      const x = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.cos(theta);

      camera.position.set(
        cameraTargetRef.current.x + x,
        cameraTargetRef.current.y + y,
        cameraTargetRef.current.z + z
      );
      camera.lookAt(cameraTargetRef.current);
    };

    updateCameraPosition();

    // 10. Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 520;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
    };
  }, [
    config, 
    showMetalFrame, 
    showInsulation, 
    showDrywall, 
    drywallOpacity, 
    showBoardLabels, 
    showOldCrookedWalls, 
    showLaserGuides, 
    showCeilingFrame, 
    showCeilingBoards, 
    ceilingBoardsOpacity, 
    showCeilingSlab, 
    ceilingSlabOpacity, 
    explodedSpacing
  ]);

  // ================= 3. RAYCASTER CLICK INSPECTOR =================
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(interactiveMeshesRef.current, true);

    if (intersects.length > 0) {
      // Find the first hit mesh with valid userData
      const hit = intersects[0];
      const clickedMesh = hit.object as THREE.Mesh;
      if (clickedMesh && clickedMesh.userData && clickedMesh.userData.name) {
        setInspectedElement(clickedMesh.userData as InspectedElementInfo);
      }
    }
  };

  // ================= 4. MOUSE ORBIT & PAN CONTROLS =================
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) isDraggingRef.current = true;
    if (e.button === 2) isRightDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

    if (!cameraRef.current) return;

    if (isDraggingRef.current) {
      // Orbit camera
      cameraSphericalRef.current.theta -= deltaX * 0.008;
      cameraSphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI / 2 + 0.1, cameraSphericalRef.current.phi - deltaY * 0.008)
      );

      const { radius, theta, phi } = cameraSphericalRef.current;
      cameraRef.current.position.set(
        cameraTargetRef.current.x + radius * Math.sin(phi) * Math.sin(theta),
        cameraTargetRef.current.y + radius * Math.cos(phi),
        cameraTargetRef.current.z + radius * Math.sin(phi) * Math.cos(theta)
      );
      cameraRef.current.lookAt(cameraTargetRef.current);
    } else if (isRightDraggingRef.current) {
      // Pan camera
      const panSpeed = 0.004 * (cameraSphericalRef.current.radius / 8);
      const right = new THREE.Vector3();
      cameraRef.current.getWorldDirection(right);
      right.cross(cameraRef.current.up).normalize();

      cameraTargetRef.current.addScaledVector(right, -deltaX * panSpeed);
      cameraTargetRef.current.y += deltaY * panSpeed;

      const { radius, theta, phi } = cameraSphericalRef.current;
      cameraRef.current.position.set(
        cameraTargetRef.current.x + radius * Math.sin(phi) * Math.sin(theta),
        cameraTargetRef.current.y + radius * Math.cos(phi),
        cameraTargetRef.current.z + radius * Math.sin(phi) * Math.cos(theta)
      );
      cameraRef.current.lookAt(cameraTargetRef.current);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isRightDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!cameraRef.current) return;
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraSphericalRef.current.radius = Math.max(2.5, Math.min(22, cameraSphericalRef.current.radius * zoomFactor));

    const { radius, theta, phi } = cameraSphericalRef.current;
    cameraRef.current.position.set(
      cameraTargetRef.current.x + radius * Math.sin(phi) * Math.sin(theta),
      cameraTargetRef.current.y + radius * Math.cos(phi),
      cameraTargetRef.current.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(cameraTargetRef.current);
  };

  const setCameraPreset = (preset: 'iso' | 'top' | 'front' | 'inside') => {
    setViewPreset(preset);
    if (!cameraRef.current) return;

    if (preset === 'iso') {
      cameraSphericalRef.current = { radius: 8.5, theta: Math.PI / 4, phi: Math.PI / 3.5 };
      cameraTargetRef.current.set(0, (config.height / 100) / 2, 0);
    } else if (preset === 'top') {
      cameraSphericalRef.current = { radius: 9.0, theta: 0, phi: 0.05 };
      cameraTargetRef.current.set(0, 0, 0);
    } else if (preset === 'front') {
      cameraSphericalRef.current = { radius: 8.5, theta: 0, phi: Math.PI / 2 - 0.05 };
      cameraTargetRef.current.set(0, (config.height / 100) / 2, 0);
    } else if (preset === 'inside') {
      cameraSphericalRef.current = { radius: 3.2, theta: Math.PI / 3, phi: Math.PI / 2.2 };
      cameraTargetRef.current.set(0, 1.2, 0);
    }

    const { radius, theta, phi } = cameraSphericalRef.current;
    cameraRef.current.position.set(
      cameraTargetRef.current.x + radius * Math.sin(phi) * Math.sin(theta),
      cameraTargetRef.current.y + radius * Math.cos(phi),
      cameraTargetRef.current.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(cameraTargetRef.current);
  };

  const handleZoom = (direction: number) => {
    if (!cameraRef.current) return;
    const factor = direction > 0 ? 1.15 : 0.85;
    cameraSphericalRef.current.radius = Math.max(2.5, Math.min(22, cameraSphericalRef.current.radius * factor));
    const { radius, theta, phi } = cameraSphericalRef.current;
    cameraRef.current.position.set(
      cameraTargetRef.current.x + radius * Math.sin(phi) * Math.sin(theta),
      cameraTargetRef.current.y + radius * Math.cos(phi),
      cameraTargetRef.current.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(cameraTargetRef.current);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col space-y-0">
      
      {/* 1. TOP CONTROL BAR (OUTSIDE THE VIEWPORT - 100% CLEAN CANVAS) */}
      <div className="bg-slate-900 text-white p-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setCameraPreset('iso')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                viewPreset === 'iso' ? 'bg-[#00529B] text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Izometrija
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('top')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                viewPreset === 'top' ? 'bg-[#00529B] text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Tlocrt (Odozgo)
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('front')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                viewPreset === 'front' ? 'bg-[#00529B] text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Čeoni pogled
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('inside')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                viewPreset === 'inside' ? 'bg-[#00529B] text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Unutarnji pogled
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1 pl-2 border-l border-slate-800">
            <button
              type="button"
              onClick={() => handleZoom(-1.0)}
              className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Približi (Zoom in)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(1.0)}
              className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Udalji (Zoom out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset('iso')}
              className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Resetiraj pogled"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Viewport status note */}
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800/80 text-[11px] font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Čisti 3D Canvas • Kliknite profil za inspekciju</span>
          </span>
        </div>
      </div>

      {/* 2. 100% CLEAN 3D VIEWPORT CANVAS (NO FLOATING OVERLAYS BLOCKING THE 3D MODEL) */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="relative w-full h-[480px] sm:h-[560px] lg:h-[600px] xl:h-[660px] bg-slate-950 cursor-grab active:cursor-grabbing select-none overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-full block"
        />

        {/* Minimal non-intrusive bottom hints */}
        <div className="absolute bottom-2 left-3 pointer-events-none text-[10px] text-slate-400/80 bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-800">
          Lijevi klik: Rotacija | Desni klik: Pomak | Kotačić: Zoom | Klik na element: Prikaz tehničkih detalja
        </div>

        {/* Board Counter badge */}
        {showDrywall && (
          <div className="absolute top-2 right-3 pointer-events-none text-[10px] font-mono text-emerald-300 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded border border-emerald-800/60 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Generirano: <strong>{boardStats.total}</strong> individualnih ploča</span>
          </div>
        )}
      </div>

      {/* 3. ELEMENT INSPECTOR CARD (PLACED DIRECTLY BELOW VIEWPORT - OUTSIDE) */}
      {inspectedElement && (
        <div className="bg-blue-50/90 border-t border-b border-blue-200 p-3 sm:px-4 animate-fadeIn">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#00529B] text-white rounded-md shadow-xs">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                  <span>{inspectedElement.name}</span>
                  {inspectedElement.profileCode && (
                    <span className="px-2 py-0.5 bg-blue-100 text-[#00529B] rounded font-mono text-[10px] font-bold">
                      {inspectedElement.profileCode}
                    </span>
                  )}
                </div>
                {inspectedElement.dimensions && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Dimenzije: <strong>{inspectedElement.dimensions}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {inspectedElement.standardKey && (
                <StandardBadge stdKey={inspectedElement.standardKey} />
              )}
              <button
                type="button"
                onClick={() => setInspectedElement(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
                title="Zatvori inspekciju"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
            <div className="bg-white p-2 rounded border border-blue-100 space-y-0.5">
              <strong className="text-[#00529B] text-[10px] uppercase tracking-wide block">Funkcija u sustavu:</strong>
              <p className="text-[11px] leading-normal text-slate-700">{inspectedElement.role}</p>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100 space-y-0.5">
              <strong className="text-[#00529B] text-[10px] uppercase tracking-wide block">Pravilo ugradnje po normi:</strong>
              <p className="text-[11px] leading-normal text-slate-700">{inspectedElement.rule}</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUB-VIEWPORT CONTROLS BAR: LAYER TOGGLES & EXPLODED VIEW SLIDER (OUTSIDE VIEWPORT) */}
      <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-300 space-y-3.5 text-xs">
        
        {/* Layer Toggles Row */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00529B]" />
              Slojevi Prikaza i Elementi Konstrukcije
            </span>
            <span className="text-[11px] text-slate-400">Uključite ili isključite slojeve za pregled unutrašnjosti</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-2">
            {/* Metal Frame Toggle */}
            <button
              type="button"
              onClick={() => setShowMetalFrame(prev => !prev)}
              className={`p-2 rounded-lg border text-left transition-all ${
                showMetalFrame 
                  ? 'bg-white border-[#00529B] text-slate-900 shadow-2xs' 
                  : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
                <span className="font-bold text-xs truncate">1. CW/UW Profili</span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">Zidna rešetka</span>
            </button>

            {/* Ceiling CD/UD Substructure Toggle */}
            {config.ceilingMode !== 'none' && (
              <button
                type="button"
                onClick={() => setShowCeilingFrame(prev => !prev)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  showCeilingFrame 
                    ? 'bg-sky-50 border-sky-500 text-sky-950 shadow-2xs ring-1 ring-sky-300' 
                    : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></span>
                  <span className="font-bold text-xs truncate">2. CD/UD Profili</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">{config.ceilingMode === 'double_cd' ? 'D112' : 'D113'} + ovjesi</span>
              </button>
            )}

            {/* Ceiling Drywall Boards Toggle */}
            {config.ceilingMode !== 'none' && (
              <button
                type="button"
                onClick={() => setShowCeilingBoards(prev => !prev)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  showCeilingBoards 
                    ? 'bg-cyan-50 border-cyan-400 text-cyan-950 shadow-2xs' 
                    : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0"></span>
                  <span className="font-bold text-xs truncate">3. Stropne ploče</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">{showCeilingBoards ? `${Math.round(ceilingBoardsOpacity * 100)}% prozirno` : 'Isključeno'}</span>
              </button>
            )}

            {/* Concrete Ceiling Slab Cover Toggle */}
            {config.ceilingMode !== 'none' && (
              <button
                type="button"
                onClick={() => setShowCeilingSlab(prev => !prev)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  showCeilingSlab 
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-2xs' 
                    : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                  <span className="font-bold text-xs truncate">4. Betonska ploča</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">{showCeilingSlab ? 'Transparentna' : 'Skrivena'}</span>
              </button>
            )}

            {/* Mineral Wool Insulation Toggle */}
            {(config.hasInsulation || config.ceilingHasInsulation) && (
              <button
                type="button"
                onClick={() => setShowInsulation(prev => !prev)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  showInsulation 
                    ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-2xs' 
                    : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0"></span>
                  <span className="font-bold text-xs truncate">5. Mineralna vuna</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">Zid & Strop</span>
              </button>
            )}

            {/* Drywall Wall Boards Toggle */}
            <button
              type="button"
              onClick={() => setShowDrywall(prev => !prev)}
              className={`p-2 rounded-lg border text-left transition-all ${
                showDrywall 
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-2xs' 
                  : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="font-bold text-xs truncate">6. Zidne ploče</span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">{Math.round(drywallOpacity * 100)}% pokrivnost</span>
            </button>

            {/* Board Numbers Toggle */}
            {showDrywall && (
              <button
                type="button"
                onClick={() => setShowBoardLabels(prev => !prev)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  showBoardLabels 
                    ? 'bg-blue-50 border-blue-400 text-blue-950 shadow-2xs' 
                    : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Hash className="w-3 h-3 text-blue-600 shrink-0" />
                  <span className="font-bold text-xs truncate">Oznake (#)</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">Broj & format</span>
              </button>
            )}

            {/* Knauf Dallas / Alux Corner Tapes Toggle */}
            <button
              type="button"
              onClick={() => setShowCornerTapes(prev => !prev)}
              className={`p-2 rounded-lg border text-left transition-all ${
                showCornerTapes 
                  ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-2xs ring-1 ring-amber-300' 
                  : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                <span className="font-bold text-xs truncate">7. Kutne trake</span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">Dallas / Alux</span>
            </button>

            {/* Crooked old walls */}
            {config.shape === 'asymmetric' && (
              <button
                type="button"
                onClick={() => setShowOldCrookedWalls(prev => !prev)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  showOldCrookedWalls 
                    ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-2xs' 
                    : 'bg-slate-200/70 border-slate-300 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0"></span>
                  <span className="font-bold text-xs truncate">Stari zidovi</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">Kosi kutevi</span>
              </button>
            )}
          </div>
        </div>

        {/* Controls: Exploded View & Drywall & Ceiling Opacity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
          
          {/* Exploded View Slider */}
          <div className="p-3 bg-white rounded-lg border border-slate-300 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5 text-amber-700">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Exploded View:
              </span>
              <span className="font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {explodedSpacing > 0 ? `${Math.round(explodedSpacing * 100)}%` : '0%'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Razmiče profile, vunu, gips ploče i strop prema van.
            </p>
            <input
              id="slider_exploded_view"
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={explodedSpacing}
              onChange={(e) => setExplodedSpacing(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>

          {/* Wall Drywall Opacity Slider */}
          <div className="p-3 bg-white rounded-lg border border-slate-300 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Eye className="w-4 h-4 text-emerald-600" />
                Prozirnost zidnih ploča:
              </span>
              <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {Math.round(drywallOpacity * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Podešavanje vidljivosti CW profila kroz zidne ploče.
            </p>
            <input
              id="slider_drywall_opacity"
              type="range"
              min="0.15"
              max="1.0"
              step="0.05"
              value={drywallOpacity}
              onChange={(e) => setDrywallOpacity(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00529B]"
            />
          </div>

          {/* Ceiling Drywall Opacity Slider */}
          <div className="p-3 bg-white rounded-lg border border-slate-300 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5 text-sky-800">
                <Eye className="w-4 h-4 text-sky-600" />
                Prozirnost stropnih ploča:
              </span>
              <span className="font-mono text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {Math.round(ceilingBoardsOpacity * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Učinite strop poluprozirnim za istovremeni pregled CD mreže.
            </p>
            <input
              id="slider_ceiling_drywall_opacity"
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={ceilingBoardsOpacity}
              onChange={(e) => {
                setCeilingBoardsOpacity(parseFloat(e.target.value));
                if (!showCeilingBoards) setShowCeilingBoards(true);
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />
          </div>

        </div>

      </div>

    </div>
  );
};
