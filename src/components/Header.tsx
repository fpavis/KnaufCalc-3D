import React, { useState, useRef, useEffect } from 'react';
import { 
  Building, 
  HelpCircle, 
  Sparkles, 
  Box, 
  ShieldCheck, 
  RotateCcw,
  BookOpen,
  FolderOpen,
  ChevronDown
} from 'lucide-react';
import { RoomConfig } from '../types';
import { generateRectangularCorners, generateAsymmetricCorners, generateLShapedCorners } from '../utils/geometry';

interface HeaderProps {
  onOpenGuide: () => void;
  onSelectPreset: (preset: RoomConfig) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenGuide, onSelectPreset }) => {
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPresetsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const PRESETS: { name: string; desc: string; config: RoomConfig }[] = [
    {
      name: 'Pravilna soba 600×300 cm (Jug + Istok otvori)',
      desc: 'Pravokutna soba 600x300 cm: Vrata i prozor (100cm) na jugu, prozor (60cm) na istoku',
      config: {
        shape: 'rectangular',
        length: 600,
        width: 300,
        height: 260,
        corners: generateRectangularCorners(600, 300),
        constructionMode: 'freestanding_lining',
        studSpacing: 600,
        studProfile: 'CW_50',
        trackProfile: 'UW_50',
        profileLengthMeters: 3.0,
        enableStraightening: false,
        straightenWallDistance: 5,
        boardType: 'standard',
        boardLayers: 1,
        boardSize: '2000x1250',
        hasInsulation: true,
        insulationType: 'mineral_wool_50',
        ceilingMode: 'double_cd',
        ceilingHangerType: 'wire_anchor',
        ceilingDropDistanceCm: 15,
        ceilingPrimarySpacing: 900,
        ceilingSecondarySpacing: 500,
        ceilingHangerSpacing: 800,
        ceilingBoardLayers: 1,
        ceilingHasInsulation: true,
        ceilingInsulationThickness: 50,
        openings: [
          {
            id: 'op_door_south',
            type: 'door',
            name: 'Vrata (Južni zid Z3)',
            wallIndex: 2, // South wall (Zid 3: x from 600 to 0 at y=300)
            distanceFromStart: 80,
            width: 90,
            height: 205,
            useUAProfile: true,
          },
          {
            id: 'op_win_south',
            type: 'window',
            name: 'Prozor 100 cm (Južni zid Z3)',
            wallIndex: 2, // South wall (Zid 3)
            distanceFromStart: 320,
            width: 100,
            height: 130,
            sillHeight: 90,
          },
          {
            id: 'op_win_east',
            type: 'window',
            name: 'Prozor 60 cm (Istočni zid Z2)',
            wallIndex: 1, // East wall (Zid 2: y from 0 to 300 at x=600)
            distanceFromStart: 120,
            width: 60,
            height: 120,
            sillHeight: 100,
          },
        ],
        partitionWalls: [],
      },
    },
    {
      name: 'Nesimetrična soba (Kosi zid 86°)',
      desc: 'Samostojeće izravnavanje nepravilnih kuteva',
      config: {
        shape: 'asymmetric',
        length: 480,
        width: 360,
        height: 265,
        corners: generateAsymmetricCorners(480, 360, 45),
        constructionMode: 'freestanding_lining',
        studSpacing: 600,
        studProfile: 'CW_50',
        trackProfile: 'UW_50',
        profileLengthMeters: 3.0,
        enableStraightening: true,
        straightenWallDistance: 5,
        boardType: 'standard',
        boardLayers: 1,
        boardSize: '2000x1250',
        hasInsulation: true,
        insulationType: 'mineral_wool_50',
        ceilingMode: 'double_cd',
        ceilingHangerType: 'wire_anchor',
        ceilingDropDistanceCm: 20,
        ceilingPrimarySpacing: 900,
        ceilingSecondarySpacing: 500,
        ceilingHangerSpacing: 800,
        ceilingBoardLayers: 1,
        ceilingHasInsulation: true,
        ceilingInsulationThickness: 50,
        openings: [
          {
            id: 'op_door_1',
            type: 'door',
            name: 'Sobna Vrata',
            wallIndex: 0,
            distanceFromStart: 80,
            width: 90,
            height: 205,
            useUAProfile: true,
          },
          {
            id: 'op_win_1',
            type: 'window',
            name: 'Dvokrilni Prozor',
            wallIndex: 2,
            distanceFromStart: 120,
            width: 140,
            height: 140,
            sillHeight: 90,
          },
        ],
        partitionWalls: [],
      },
    },
    {
      name: 'Kupaonica (GKBI Vlagootporna)',
      desc: 'Razmak 400mm + 2 sloja zelenog gipsa za keramiku',
      config: {
        shape: 'rectangular',
        length: 280,
        width: 220,
        height: 260,
        corners: generateRectangularCorners(280, 220),
        constructionMode: 'freestanding_lining',
        studSpacing: 400, // 400mm spacing for heavy wall tiles!
        studProfile: 'CW_75',
        trackProfile: 'UW_75',
        profileLengthMeters: 3.0,
        enableStraightening: false,
        straightenWallDistance: 5,
        boardType: 'moisture_resistant', // Green GKBI
        boardLayers: 2, // 2 layers for moisture/tiles
        boardSize: '2000x1250',
        hasInsulation: true,
        insulationType: 'mineral_wool_75',
        ceilingMode: 'direct_cd',
        ceilingHangerType: 'direct_hanger',
        ceilingDropDistanceCm: 10,
        ceilingPrimarySpacing: 800,
        ceilingSecondarySpacing: 400,
        ceilingHangerSpacing: 800,
        ceilingBoardLayers: 2,
        ceilingHasInsulation: true,
        ceilingInsulationThickness: 50,
        openings: [
          {
            id: 'op_door_bath',
            type: 'door',
            name: 'Vrata kupaonice',
            wallIndex: 0,
            distanceFromStart: 40,
            width: 80,
            height: 205,
            useUAProfile: true,
          },
        ],
        partitionWalls: [],
      },
    },
    {
      name: 'Stan s Pregradnim Zidom',
      desc: 'W112 pregrada + dvorazinski spušteni strop D112',
      config: {
        shape: 'rectangular',
        length: 550,
        width: 420,
        height: 275,
        corners: generateRectangularCorners(550, 420),
        constructionMode: 'freestanding_lining',
        studSpacing: 600,
        studProfile: 'CW_50',
        trackProfile: 'UW_50',
        profileLengthMeters: 3.0,
        enableStraightening: false,
        straightenWallDistance: 5,
        boardType: 'standard',
        boardLayers: 1,
        boardSize: '2600x1200',
        hasInsulation: true,
        insulationType: 'mineral_wool_50',
        ceilingMode: 'double_cd',
        ceilingHangerType: 'wire_anchor',
        ceilingDropDistanceCm: 25,
        ceilingPrimarySpacing: 900,
        ceilingSecondarySpacing: 500,
        ceilingHangerSpacing: 900,
        ceilingBoardLayers: 1,
        ceilingHasInsulation: true,
        ceilingInsulationThickness: 50,
        openings: [
          {
            id: 'op_d1',
            type: 'door',
            name: 'Ulazna Vrata (Soba 1)',
            wallIndex: 0,
            distanceFromStart: 50,
            width: 90,
            height: 205,
            useUAProfile: true,
          },
          {
            id: 'op_w1',
            type: 'window',
            name: 'Prozor Dnevni Boravak (Soba 1)',
            wallIndex: 2,
            distanceFromStart: 350,
            width: 120,
            height: 140,
            sillHeight: 85,
          },
          {
            id: 'op_w2',
            type: 'window',
            name: 'Prozor Spavaća Soba (Soba 2)',
            wallIndex: 2,
            distanceFromStart: 70,
            width: 120,
            height: 140,
            sillHeight: 85,
          },
        ],
        partitionWalls: [
          {
            id: 'part_main',
            name: 'Pregradni zid W112 (Dnevni / Spavaća)',
            startX: 275,
            startY: 0,
            endX: 275,
            endY: 420,
            height: 275,
            profileType: 'CW_75',
            layers: 2,
            hasInsulation: true,
            openings: [
              {
                id: 'part_door',
                type: 'door',
                name: 'Sobna vrata (Prolaz)',
                wallIndex: 0,
                distanceFromStart: 130,
                width: 85,
                height: 205,
                useUAProfile: true,
              },
            ],
          },
        ],
      },
    },
  ];

  return (
    <header className="bg-[#00529B] text-white border-b border-blue-900 shadow-md">
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white shadow-xs">
            <div className="h-5 w-5 bg-[#00529B]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }}></div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight uppercase text-white">
                KnaufCalc 3D <span className="text-xs font-normal opacity-75">v4.2 PRO</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Quick Presets & Guide Buttons */}
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="hidden sm:inline opacity-80 text-xs">Standard: HRN EN 520 / DIN 18181</span>

          {/* Preset selector dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="btn_presets_menu"
              type="button"
              onClick={() => setIsPresetsOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-all text-xs font-semibold ${
                isPresetsOpen 
                  ? 'bg-white text-[#00529B] border-white shadow-sm' 
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
              }`}
            >
              <FolderOpen className={`w-3.5 h-3.5 ${isPresetsOpen ? 'text-[#00529B]' : 'text-blue-200'}`} />
              <span>Predlošci</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isPresetsOpen ? 'rotate-180 text-[#00529B]' : 'text-blue-200'}`} />
            </button>

            {isPresetsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 p-2 z-50 animate-fadeIn text-slate-100 divide-y divide-slate-800">
                <div className="text-[10px] font-bold text-slate-400 px-2 py-1.5 uppercase tracking-wider">
                  Brzo učitavanje konfiguracije
                </div>
                <div className="space-y-1 pt-1.5">
                  {PRESETS.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => {
                        onSelectPreset(preset.config);
                        setIsPresetsOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 transition-colors text-xs space-y-1 group/item border border-transparent hover:border-slate-700"
                    >
                      <div className="font-bold text-slate-100 group-hover/item:text-blue-300 flex items-center justify-between">
                        <span>{preset.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 group-hover/item:bg-blue-900/60 font-mono">
                          Učitaj →
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-normal">
                        {preset.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Assembly Guide Button */}
          <button
            id="btn_open_knauf_guide"
            type="button"
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#00529B] hover:bg-blue-50 rounded text-xs font-bold shadow-xs transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#00529B]" />
            <span>Pravila Montaže</span>
          </button>
        </div>
      </div>
    </header>
  );
};
