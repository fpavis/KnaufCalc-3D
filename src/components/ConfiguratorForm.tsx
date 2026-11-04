import React, { useState } from 'react';
import { 
  RoomConfig, 
  RoomShapeType, 
  ConstructionMode, 
  StudProfileType, 
  TrackProfileType, 
  BoardType, 
  CeilingMode, 
  CeilingHangerType,
  Opening, 
  PartitionWall 
} from '../types';
import { 
  generateRectangularCorners, 
  generateAsymmetricCorners, 
  generateLShapedCorners,
  analyzeWallSegments,
  checkPartitionOpeningConflicts,
  detectSubRooms
} from '../utils/geometry';
import { calculateDrywallMaterials } from '../utils/calculator';
import { NumericInput } from './NumericInput';
import { 
  Settings, 
  Maximize, 
  Sliders, 
  DoorClosed, 
  Plus, 
  Trash2, 
  Layers, 
  ShieldCheck, 
  Wrench, 
  Sparkles, 
  Square, 
  Building2,
  HelpCircle,
  CheckCircle2,
  Droplets,
  Flame,
  Volume2,
  Grid,
  Compass,
  ArrowDownToLine,
  Hash
} from 'lucide-react';

interface ConfiguratorFormProps {
  config: RoomConfig;
  onChange: (newConfig: RoomConfig) => void;
}

export const ConfiguratorForm: React.FC<ConfiguratorFormProps> = ({ config, onChange }) => {
  const [activeTab, setActiveTab] = useState<'dimensions' | 'construction' | 'ceiling' | 'openings' | 'partitions' | 'boards'>('dimensions');

  // Handle shape change
  const handleShapeChange = (shape: RoomShapeType) => {
    let newCorners = config.corners;
    if (shape === 'rectangular') {
      newCorners = generateRectangularCorners(config.length, config.width);
    } else if (shape === 'asymmetric') {
      newCorners = generateAsymmetricCorners(config.length, config.width, 35);
    } else if (shape === 'l_shaped') {
      newCorners = generateLShapedCorners(config.length, config.width);
    }

    // If asymmetric, auto-suggest freestanding lining if current is direct
    let mode = config.constructionMode;
    if (shape === 'asymmetric' && mode === 'wall_lining_direct') {
      mode = 'freestanding_lining';
    }

    onChange({
      ...config,
      shape,
      corners: newCorners,
      constructionMode: mode,
      enableStraightening: shape === 'asymmetric',
    });
  };

  // Handle Dimension changes safely
  const handleLengthChange = (length: number) => {
    const l = Math.max(10, length);
    const newCorners = config.shape === 'rectangular'
      ? generateRectangularCorners(l, config.width)
      : config.shape === 'asymmetric'
      ? generateAsymmetricCorners(l, config.width, 35)
      : generateLShapedCorners(l, config.width);

    onChange({ ...config, length: l, corners: newCorners });
  };

  const handleWidthChange = (width: number) => {
    const w = Math.max(10, width);
    const newCorners = config.shape === 'rectangular'
      ? generateRectangularCorners(config.length, w)
      : config.shape === 'asymmetric'
      ? generateAsymmetricCorners(config.length, w, 35)
      : generateLShapedCorners(config.length, w);

    onChange({ ...config, width: w, corners: newCorners });
  };

  const handleCornerCoordChange = (index: number, field: 'x' | 'y', val: number) => {
    const updated = [...config.corners];
    updated[index] = { ...updated[index], [field]: val };
    onChange({ ...config, corners: updated });
  };

  // Openings management
  const addOpening = (type: 'door' | 'window') => {
    const newOp: Opening = {
      id: `op_${Date.now()}`,
      type,
      name: type === 'door' ? `Vrata ${config.openings.length + 1}` : `Prozor ${config.openings.length + 1}`,
      wallIndex: 0,
      distanceFromStart: 60,
      width: type === 'door' ? 90 : 120,
      height: type === 'door' ? 205 : 140,
      sillHeight: type === 'window' ? 90 : 0,
      useUAProfile: type === 'door', // default UA for strong doors
    };
    onChange({ ...config, openings: [...config.openings, newOp] });
  };

  const updateOpening = (index: number, partial: Partial<Opening>) => {
    const updated = [...config.openings];
    updated[index] = { ...updated[index], ...partial };
    onChange({ ...config, openings: updated });
  };

  const removeOpening = (index: number) => {
    const updated = config.openings.filter((_, i) => i !== index);
    onChange({ ...config, openings: updated });
  };

  // Partition walls management
  const addPartitionWall = () => {
    const newPart: PartitionWall = {
      id: `part_${Date.now()}`,
      name: `Pregrada ${config.partitionWalls.length + 1}`,
      startX: Math.round(config.length * 0.5),
      startY: 0,
      endX: Math.round(config.length * 0.5),
      endY: config.width,
      height: config.height,
      profileType: 'CW_75',
      layers: 1,
      hasInsulation: true,
      openings: [],
    };
    onChange({ ...config, partitionWalls: [...config.partitionWalls, newPart] });
  };

  const updatePartition = (index: number, partial: Partial<PartitionWall>) => {
    const updated = [...config.partitionWalls];
    updated[index] = { ...updated[index], ...partial };
    onChange({ ...config, partitionWalls: updated });
  };

  const removePartition = (index: number) => {
    const updated = config.partitionWalls.filter((_, i) => i !== index);
    onChange({ ...config, partitionWalls: updated });
  };

  const segments = analyzeWallSegments(config.corners);

  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-2xs overflow-hidden flex flex-col h-full">
      {/* High-visibility Responsive Tab Navigation Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 border-b border-slate-300 bg-slate-100 p-1.5 gap-1.5">
        <button
          id="tab_dimensions"
          type="button"
          onClick={() => setActiveTab('dimensions')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap ${
            activeTab === 'dimensions'
              ? 'bg-[#00529B] text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 bg-white border border-slate-200'
          }`}
        >
          <Maximize className="w-3.5 h-3.5 shrink-0" />
          <span>1. Dimenzije</span>
        </button>

        <button
          id="tab_construction"
          type="button"
          onClick={() => setActiveTab('construction')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap ${
            activeTab === 'construction'
              ? 'bg-[#00529B] text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 bg-white border border-slate-200'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          <span>2. Zidovi</span>
        </button>

        {/* DEDICATED SPUŠTENI STROP TAB */}
        <button
          id="tab_ceiling"
          type="button"
          onClick={() => setActiveTab('ceiling')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap border ${
            activeTab === 'ceiling'
              ? 'bg-[#00529B] text-white border-[#00529B] shadow-xs'
              : config.ceilingMode !== 'none'
              ? 'bg-sky-50 text-sky-900 border-sky-300 hover:bg-sky-100 hover:text-sky-950'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 bg-white border-slate-200'
          }`}
        >
          <Grid className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'ceiling' ? 'text-white' : config.ceilingMode !== 'none' ? 'text-sky-600' : 'text-slate-500'}`} />
          <span>3. Strop {config.ceilingMode !== 'none' && '✓'}</span>
        </button>

        <button
          id="tab_openings"
          type="button"
          onClick={() => setActiveTab('openings')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap ${
            activeTab === 'openings'
              ? 'bg-[#00529B] text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 bg-white border border-slate-200'
          }`}
        >
          <DoorClosed className="w-3.5 h-3.5 shrink-0" />
          <span>4. Otvori ({config.openings.length})</span>
        </button>

        <button
          id="tab_partitions"
          type="button"
          onClick={() => setActiveTab('partitions')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap border ${
            activeTab === 'partitions'
              ? 'bg-[#00529B] text-white border-[#00529B] shadow-xs'
              : 'bg-purple-50/90 text-purple-900 border-purple-200 hover:bg-purple-100 hover:text-purple-950'
          }`}
        >
          <Building2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'partitions' ? 'text-white' : 'text-purple-700'}`} />
          <span>5. Pregrade ({config.partitionWalls.length})</span>
        </button>

        <button
          id="tab_boards"
          type="button"
          onClick={() => setActiveTab('boards')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap ${
            activeTab === 'boards'
              ? 'bg-[#00529B] text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 bg-white border border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>6. Ploče</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[660px] xl:max-h-[740px]">
        {/* ================= TAB 1: DIMENSIONS & SHAPE ================= */}
        {activeTab === 'dimensions' && (
          <div className="space-y-4">
            {/* Shape selection */}
            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Geometrijski oblik prostorije
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="btn_shape_rect"
                  type="button"
                  onClick={() => handleShapeChange('rectangular')}
                  className={`p-2.5 rounded border text-left transition-all ${
                    config.shape === 'rectangular'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Pravokutna</span>
                    <Square className="w-4 h-4 text-[#00529B]" />
                  </div>
                  <p className="text-[11px] text-slate-500">Standardna (90° kutevi)</p>
                </button>

                <button
                  id="btn_shape_asym"
                  type="button"
                  onClick={() => handleShapeChange('asymmetric')}
                  className={`p-2.5 rounded border text-left transition-all ${
                    config.shape === 'asymmetric'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Nesimetrična</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold uppercase">Kosi</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Krivi kutevi, izravnavanje</p>
                </button>

                <button
                  id="btn_shape_l"
                  type="button"
                  onClick={() => handleShapeChange('l_shaped')}
                  className={`p-2.5 rounded border text-left transition-all ${
                    config.shape === 'l_shaped'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">L - Oblik</span>
                    <span className="text-[10px] text-slate-400 font-mono">6 zidova</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Lomljeni prostor</p>
                </button>
              </div>
            </div>

            {/* Basic Room Measurements */}
            <div className="p-3.5 bg-slate-50 rounded border border-slate-300 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Dimenzije Prostorije (cm / m)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                    DUŽINA
                  </label>
                  <NumericInput
                    id="input_room_length"
                    min={100}
                    max={3000}
                    step={10}
                    unit="cm"
                    value={config.length}
                    onChange={handleLengthChange}
                  />
                  <span className="text-[10px] text-slate-500 font-mono block font-semibold">{(config.length / 100).toFixed(2)} m</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                    ŠIRINA
                  </label>
                  <NumericInput
                    id="input_room_width"
                    min={100}
                    max={3000}
                    step={10}
                    unit="cm"
                    value={config.width}
                    onChange={handleWidthChange}
                  />
                  <span className="text-[10px] text-slate-500 font-mono block font-semibold">{(config.width / 100).toFixed(2)} m</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                    VISINA STROPA
                  </label>
                  <NumericInput
                    id="input_room_height"
                    min={180}
                    max={600}
                    step={5}
                    unit="cm"
                    value={config.height}
                    onChange={(h) => onChange({ ...config, height: h })}
                  />
                  <span className="text-[10px] text-slate-500 font-mono block font-semibold">{(config.height / 100).toFixed(2)} m</span>
                </div>
              </div>
            </div>

            {/* Asymmetric corner fine-tuning */}
            {config.shape === 'asymmetric' && (
              <div className="space-y-3 p-3.5 bg-amber-50/50 rounded border border-amber-300">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Podešavanje koordinata kuteva (cm):
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, corners: generateAsymmetricCorners(config.length, config.width, 35) })}
                    className="text-[11px] font-semibold text-amber-800 hover:underline"
                  >
                    Resetiraj kuteve
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {config.corners.map((corner, cIdx) => (
                    <div key={`corner_${cIdx}`} className="bg-white p-2 rounded border border-amber-200">
                      <div className="font-bold text-slate-700 mb-1 text-[11px]">Kut #{cIdx + 1}</div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-mono text-[10px]">X:</span>
                        <NumericInput
                          min={-500}
                          max={3500}
                          value={Math.round(corner.x)}
                          onChange={(val) => handleCornerCoordChange(cIdx, 'x', val)}
                          inputClassName="px-1.5 py-0.5 text-xs font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-slate-400 font-mono text-[10px]">Y:</span>
                        <NumericInput
                          min={-500}
                          max={3500}
                          value={Math.round(corner.y)}
                          onChange={(val) => handleCornerCoordChange(cIdx, 'y', val)}
                          inputClassName="px-1.5 py-0.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Straightening option */}
                <div className="pt-2 border-t border-amber-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      Ortogonalno izravnavanje (Laser 90.0°)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Samostojeći predzid s promjenjivim zazorom koji poništava neravnine.
                    </div>
                  </div>
                  <input
                    id="toggle_straightening_checkbox"
                    type="checkbox"
                    checked={config.enableStraightening}
                    onChange={(e) => onChange({ ...config, enableStraightening: e.target.checked })}
                    className="h-4 w-4 rounded text-[#00529B] focus:ring-[#00529B]"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: CONSTRUCTION & PROFILES ================= */}
        {activeTab === 'construction' && (
          <div className="space-y-4">
            {/* Mode selection */}
            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Tip Potkonstrukcije
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  id="btn_mode_freestanding"
                  type="button"
                  onClick={() => onChange({ 
                    ...config, 
                    constructionMode: 'freestanding_lining',
                    studProfile: 'CW_50',
                    trackProfile: 'UW_50'
                  })}
                  className={`p-3 rounded border text-left transition-all ${
                    config.constructionMode === 'freestanding_lining'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Samostojeća (CW / UW)</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-[#00529B] rounded font-bold">Knauf W625</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Samonosiva bez sidrenja u zid. Preporučeno za asimetriju, toplinsku izolaciju i instalacije.
                  </p>
                </button>

                <button
                  id="btn_mode_direct"
                  type="button"
                  onClick={() => onChange({ 
                    ...config, 
                    constructionMode: 'wall_lining_direct',
                    studProfile: 'CD_60_27',
                    trackProfile: 'UD_28_27'
                  })}
                  className={`p-3 rounded border text-left transition-all ${
                    config.constructionMode === 'wall_lining_direct'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Direktno na zid (CD / UD)</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-bold">Knauf W623</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Direktni nosači u zid. Zauzima minimalno prostora (debljina konstrukcije 3-5 cm).
                  </p>
                </button>
              </div>
            </div>

            {/* Profile width & Stud Spacing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded border border-slate-300">
              {config.constructionMode === 'freestanding_lining' && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                    Dimenzija profila:
                  </label>
                  <select
                    id="select_stud_profile"
                    value={config.studProfile}
                    onChange={(e) => {
                      const sp = e.target.value as StudProfileType;
                      const tp = sp === 'CW_50' ? 'UW_50' : sp === 'CW_75' ? 'UW_75' : 'UW_100';
                      onChange({ ...config, studProfile: sp, trackProfile: tp as TrackProfileType });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                  >
                    <option value="CW_50">CW 50 / UW 50 (50mm - Standard)</option>
                    <option value="CW_75">CW 75 / UW 75 (75mm - Veća zvučna izolacija)</option>
                    <option value="CW_100">CW 100 / UW 100 (100mm - Visoki zidovi)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                  Razmak profila (Raster):
                </label>
                <select
                  id="select_stud_spacing"
                  value={config.studSpacing}
                  onChange={(e) => onChange({ ...config, studSpacing: parseInt(e.target.value) as 600 | 400 | 625 })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                >
                  <option value="600">600 mm (Standard za ploče 120/125 cm)</option>
                  <option value="400">400 mm (Pojačani za pločice / kupaonice)</option>
                  <option value="625">625 mm (DIN raster)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                  Dužina profila na skladištu:
                </label>
                <select
                  id="select_profile_length"
                  value={config.profileLengthMeters}
                  onChange={(e) => onChange({ ...config, profileLengthMeters: parseFloat(e.target.value) as 2.6 | 3.0 | 4.0 })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                >
                  <option value="2.6">2.60 m</option>
                  <option value="3.0">3.00 m (Najčešći standard)</option>
                  <option value="4.0">4.00 m</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                  Status spuštenog stropa:
                </label>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700">
                    {config.ceilingMode === 'double_cd' ? 'Knauf D112 (Dvorazinski križni)' : config.ceilingMode === 'direct_cd' ? 'Knauf D113 (Jednorazinski)' : config.ceilingMode === 'freestanding_d116' ? 'Knauf D116 (Samonosivi)' : 'Isključen'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ceiling')}
                    className="text-[#00529B] font-bold hover:underline text-[11px]"
                  >
                    Konfiguriraj u tabu 3 →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: DEDICATED SPUŠTENI STROP ================= */}
        {activeTab === 'ceiling' && (
          <div className="space-y-4">
            {/* Ceiling System Mode Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-[#00529B]" />
                  Sustav Spuštenog Stropa (Knauf Sistemi)
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* D112 Double CD */}
                <button
                  id="btn_ceiling_d112"
                  type="button"
                  onClick={() => onChange({ 
                    ...config, 
                    ceilingMode: 'double_cd',
                    ceilingPrimarySpacing: 900,
                    ceilingSecondarySpacing: 500,
                    ceilingHangerSpacing: 800,
                    ceilingHangerType: 'wire_anchor'
                  })}
                  className={`p-3 rounded border text-left transition-all ${
                    config.ceilingMode === 'double_cd'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Knauf D112 (Dvorazinska)</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-[#00529B] rounded font-bold">Standard</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Glavni nosivi CD + montažni CD profili u 2 razine spojeni križnim spojnicama. Za sve raspone i visoke zahtjeve.
                  </p>
                </button>

                {/* D113 Single CD */}
                <button
                  id="btn_ceiling_d113"
                  type="button"
                  onClick={() => onChange({ 
                    ...config, 
                    ceilingMode: 'direct_cd',
                    ceilingSecondarySpacing: 500,
                    ceilingHangerSpacing: 800,
                    ceilingHangerType: 'direct_hanger'
                  })}
                  className={`p-3 rounded border text-left transition-all ${
                    config.ceilingMode === 'direct_cd'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Knauf D113 (Jednorazinska)</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">Plitki strop</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    CD 60/27 u jednoj razini na direktnim nosačima. Minimalno smanjenje visine prostorije.
                  </p>
                </button>

                {/* D116 Freestanding */}
                <button
                  id="btn_ceiling_d116"
                  type="button"
                  onClick={() => onChange({ 
                    ...config, 
                    ceilingMode: 'freestanding_d116',
                    ceilingHangerType: 'direct_hanger'
                  })}
                  className={`p-3 rounded border text-left transition-all ${
                    config.ceilingMode === 'freestanding_d116'
                      ? 'border-2 border-purple-600 bg-purple-50/70 text-purple-950'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Knauf D116 (Samonosivi)</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold">Zid-na-zid</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Rasponski CW profili od zida do zida bez bušenja i vješanja u stropnu ploču.
                  </p>
                </button>

                {/* None */}
                <button
                  id="btn_ceiling_none"
                  type="button"
                  onClick={() => onChange({ ...config, ceilingMode: 'none' })}
                  className={`p-3 rounded border text-left transition-all ${
                    config.ceilingMode === 'none'
                      ? 'border-2 border-slate-600 bg-slate-100 text-slate-900'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Bez spuštenog stropa</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-bold">Samo zidovi</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Proračun i 3D vizualizacija uključuju samo obloge i pregrade.
                  </p>
                </button>
              </div>
            </div>

            {/* Ceiling Detailed Parameters when enabled */}
            {config.ceilingMode !== 'none' && (
              <div className="space-y-4">
                {/* Drop Distance / Plenum Height */}
                <div className="p-3.5 bg-sky-50/60 rounded border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-sky-950 flex items-center gap-1.5">
                        <ArrowDownToLine className="w-3.5 h-3.5 text-sky-700" />
                        Visina spuštanja stropa (Plenum):
                      </span>
                      <p className="text-[11px] text-sky-800">Udaljenost od postojećeg stropa do gipsane ploče</p>
                    </div>
                    <div className="w-24">
                      <NumericInput
                        min={5}
                        max={150}
                        value={config.ceilingDropDistanceCm || 15}
                        onChange={(val) => onChange({ ...config, ceilingDropDistanceCm: Math.max(5, val) })}
                        inputClassName="px-2 py-1 text-xs font-bold text-center bg-white border border-sky-300"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="1"
                    value={config.ceilingDropDistanceCm || 15}
                    onChange={(e) => onChange({ ...config, ceilingDropDistanceCm: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-sky-200 rounded appearance-none cursor-pointer accent-[#00529B]"
                  />
                  <div className="flex justify-between text-[10px] text-sky-700 font-mono">
                    <span>5 cm (Minimalno)</span>
                    <span>15 cm (Standard)</span>
                    <span>50 cm</span>
                    <span>100 cm (Visoko spuštanje)</span>
                  </div>
                </div>

                {/* Hanger Type Selection */}
                {config.ceilingMode !== 'freestanding_d116' && (
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Vrsta Stropnog Ovjesa & Sidrenja
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => onChange({ ...config, ceilingHangerType: 'wire_anchor' })}
                        className={`p-2.5 rounded border text-left transition-all ${
                          config.ceilingHangerType === 'wire_anchor' || !config.ceilingHangerType
                            ? 'border-2 border-[#00529B] bg-blue-50/80 text-[#00529B]'
                            : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                        }`}
                      >
                        <div className="font-bold text-xs mb-0.5">Sidreni ovjes (anker)</div>
                        <p className="text-[10px] text-slate-500">S oprugom + žica s ušicom. Za spuštanje 15-100 cm.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => onChange({ ...config, ceilingHangerType: 'direct_hanger' })}
                        className={`p-2.5 rounded border text-left transition-all ${
                          config.ceilingHangerType === 'direct_hanger'
                            ? 'border-2 border-[#00529B] bg-blue-50/80 text-[#00529B]'
                            : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                        }`}
                      >
                        <div className="font-bold text-xs mb-0.5">Direktni nosač CD 60</div>
                        <p className="text-[10px] text-slate-500">Krut U-nosač za plitko spuštanje (do 12-20 cm).</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => onChange({ ...config, ceilingHangerType: 'nonius' })}
                        className={`p-2.5 rounded border text-left transition-all ${
                          config.ceilingHangerType === 'nonius'
                            ? 'border-2 border-[#00529B] bg-blue-50/80 text-[#00529B]'
                            : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                        }`}
                      >
                        <div className="font-bold text-xs mb-0.5">Nonius ovjes</div>
                        <p className="text-[10px] text-slate-500">Za veća opterećenja, protupožarnost i visoku zvučnu izolaciju.</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Spacings / Raster settings */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded border border-slate-300 text-xs">
                  {config.ceilingMode === 'double_cd' && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                        Razmak primarnih CD profila:
                      </label>
                      <select
                        value={config.ceilingPrimarySpacing || 900}
                        onChange={(e) => onChange({ ...config, ceilingPrimarySpacing: parseInt(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                      >
                        <option value="800">800 mm (Pojačano opterećenje)</option>
                        <option value="900">900 mm (Knauf standard D112)</option>
                        <option value="1000">1000 mm (Maksimalni raspon)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                      Razmak montažnih CD profila:
                    </label>
                    <select
                      value={config.ceilingSecondarySpacing || 500}
                      onChange={(e) => onChange({ ...config, ceilingSecondarySpacing: parseInt(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                    >
                      <option value="400">400 mm (Poprečna montaža / 2 sloja)</option>
                      <option value="500">500 mm (Standard za 1 sloj)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                      Razmak točaka ovjesa:
                    </label>
                    <select
                      value={config.ceilingHangerSpacing || 800}
                      onChange={(e) => onChange({ ...config, ceilingHangerSpacing: parseInt(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                    >
                      <option value="700">700 mm (Pojačana nosivost)</option>
                      <option value="800">800 mm (Standardni razmak)</option>
                      <option value="900">900 mm</option>
                      <option value="1000">1000 mm</option>
                    </select>
                  </div>
                </div>

                {/* Ceiling Board Layers & Insulation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-300">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                      Slojevi stropnih gips ploča:
                    </label>
                    <select
                      value={config.ceilingBoardLayers || 1}
                      onChange={(e) => onChange({ ...config, ceilingBoardLayers: parseInt(e.target.value) as 1 | 2 })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                    >
                      <option value="1">1 sloj (12.5 mm debljina) - Standard</option>
                      <option value="2">2 sloja (25.0 mm debljina) - Protupožarno / Zvučno</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                        Mineralna vuna u stropu:
                      </label>
                      <input
                        type="checkbox"
                        checked={config.ceilingHasInsulation ?? false}
                        onChange={(e) => onChange({ ...config, ceilingHasInsulation: e.target.checked })}
                        className="rounded text-[#00529B] focus:ring-[#00529B]"
                      />
                    </div>
                    {config.ceilingHasInsulation ? (
                      <select
                        value={config.ceilingInsulationThickness || 50}
                        onChange={(e) => onChange({ ...config, ceilingInsulationThickness: parseInt(e.target.value) as 50 | 100 })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                      >
                        <option value="50">50 mm Staklena vuna Knauf Insulation</option>
                        <option value="100">100 mm Staklena vuna Knauf Insulation</option>
                      </select>
                    ) : (
                      <div className="text-[11px] text-slate-400 py-1.5">Bez izolacije u plenumu</div>
                    )}
                  </div>
                </div>

                {/* Live Ceiling Material Breakdown Widget */}
                {(() => {
                  const liveSummary = calculateDrywallMaterials(config);
                  const ceilingCDItem = liveSummary.items.find(i => i.id === 'mat_ceiling_cd');
                  const ceilingUDItem = liveSummary.items.find(i => i.id === 'mat_ceiling_ud');
                  const ceilingHangersItem = liveSummary.items.find(i => i.category === 'hangers_connectors' && i.id.includes('ceiling'));
                  const ceilingCrossItem = liveSummary.items.find(i => i.id === 'mat_ceiling_cross');
                  const ceilingPinsItem = liveSummary.items.find(i => i.id === 'mat_ceiling_steel_pins');

                  return (
                    <div className="bg-sky-50/70 p-3.5 rounded border border-sky-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-sky-950 uppercase tracking-wide flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-sky-700" />
                          Proračun Stropnih Elemenata u Realnom Vremenu
                        </span>
                        <span className="font-mono text-sky-900 font-bold">
                          Površina: {liveSummary.totalCeilingArea.toFixed(1)} m²
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded border border-sky-200">
                          <span className="text-[10px] text-slate-500 font-bold block">CD 60/27 profili</span>
                          <span className="text-sm font-bold text-sky-900 font-mono">
                            {ceilingCDItem ? `${ceilingCDItem.exactQuantity} m (${ceilingCDItem.packagesNeeded} kom)` : '0 m'}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-sky-200">
                          <span className="text-[10px] text-slate-500 font-bold block">UD 28/27 profili</span>
                          <span className="text-sm font-bold text-sky-900 font-mono">
                            {ceilingUDItem ? `${ceilingUDItem.exactQuantity} m (${ceilingUDItem.packagesNeeded} kom)` : '0 m'}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-sky-200">
                          <span className="text-[10px] text-slate-500 font-bold block">Točke ovjesa</span>
                          <span className="text-sm font-bold text-sky-900 font-mono">
                            {ceilingHangersItem ? `${ceilingHangersItem.exactQuantity} kom` : '0 kom'}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-sky-200">
                          <span className="text-[10px] text-slate-500 font-bold block">
                            {config.ceilingMode === 'double_cd' ? 'Križne spojnice' : 'Čelični klinovi DN6'}
                          </span>
                          <span className="text-sm font-bold text-sky-900 font-mono">
                            {config.ceilingMode === 'double_cd' && ceilingCrossItem 
                              ? `${ceilingCrossItem.exactQuantity} kom` 
                              : ceilingPinsItem 
                              ? `${ceilingPinsItem.exactQuantity} kom` 
                              : '0 kom'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: OPENINGS (DOORS & WINDOWS) ================= */}
        {activeTab === 'openings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Otvori na vanjskim zidovima</h3>
                <p className="text-[11px] text-slate-500">Automatski izračun nadvratnika, UA ojačanja i profila oko otvora</p>
              </div>
              <div className="flex gap-2">
                <button
                  id="btn_add_door"
                  type="button"
                  onClick={() => addOpening('door')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-[#00529B] hover:bg-blue-100 rounded text-xs font-bold border border-blue-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Vrata
                </button>
                <button
                  id="btn_add_window"
                  type="button"
                  onClick={() => addOpening('window')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded text-xs font-bold border border-amber-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Prozor
                </button>
              </div>
            </div>

            {config.openings.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded border border-dashed border-slate-300 text-slate-500 text-xs">
                Nema dodanih otvora za vrata ili prozore. Kliknite gumb gore za dodavanje.
              </div>
            ) : (
              <div className="space-y-2.5">
                {config.openings.map((op, opIdx) => (
                  <div key={op.id} className="p-3 bg-slate-50 rounded border border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <span className={`p-1.5 rounded ${op.type === 'door' ? 'bg-blue-100 text-[#00529B]' : 'bg-amber-100 text-amber-800'}`}>
                        <DoorClosed className="w-4 h-4" />
                      </span>
                      <div>
                        <strong className="text-slate-900 font-bold">{op.name}</strong>
                        <span className="text-slate-400 ml-2 font-mono text-[11px]">({op.type === 'door' ? 'Vrata' : 'Prozor'})</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Zid:</label>
                        <select
                          value={op.wallIndex}
                          onChange={(e) => updateOpening(opIdx, { wallIndex: parseInt(e.target.value) })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium"
                        >
                          {segments.map((s, sIdx) => (
                            <option key={sIdx} value={sIdx}>{s.name} ({(s.length / 100).toFixed(2)}m)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Širina × Visina (cm):</label>
                        <div className="flex items-center gap-1">
                          <NumericInput
                            min={40}
                            max={400}
                            value={op.width}
                            onChange={(w) => updateOpening(opIdx, { width: w })}
                            inputClassName="w-14 px-1.5 py-0.5 text-xs font-mono"
                          />
                          <span>×</span>
                          <NumericInput
                            min={40}
                            max={350}
                            value={op.height}
                            onChange={(h) => updateOpening(opIdx, { height: h })}
                            inputClassName="w-14 px-1.5 py-0.5 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                          {op.type === 'window' ? 'Od kuta / Parapet (cm):' : 'Od kuta (cm):'}
                        </label>
                        <div className="flex items-center gap-1">
                          <NumericInput
                            min={0}
                            max={3000}
                            value={op.distanceFromStart}
                            onChange={(d) => updateOpening(opIdx, { distanceFromStart: d })}
                            inputClassName="w-16 px-1.5 py-0.5 text-xs font-mono"
                          />
                          {op.type === 'window' && (
                            <NumericInput
                              min={0}
                              max={200}
                              value={op.sillHeight || 90}
                              onChange={(sh) => updateOpening(opIdx, { sillHeight: sh })}
                              inputClassName="w-12 px-1 py-0.5 text-xs font-mono"
                              placeholder="Parapet"
                            />
                          )}
                        </div>
                      </div>

                      {op.type === 'door' && (
                        <div className="flex items-center pt-3">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={op.useUAProfile}
                              onChange={(e) => updateOpening(opIdx, { useUAProfile: e.target.checked })}
                              className="rounded text-[#00529B] focus:ring-[#00529B]"
                            />
                            <span className="text-[11px] font-bold text-[#00529B]">UA 2mm ojačanje</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeOpening(opIdx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors self-end sm:self-center"
                      title="Obriši otvor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: PARTITION WALLS ================= */}
        {activeTab === 'partitions' && (() => {
          const partitionConflicts = checkPartitionOpeningConflicts(config.corners, config.openings, config.partitionWalls);
          const subRooms = detectSubRooms(config.corners, config.partitionWalls, config.openings);

          // Find bounds of room to provide easy center buttons
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          config.corners.forEach(c => {
            minX = Math.min(minX, c.x);
            maxX = Math.max(maxX, c.x);
            minY = Math.min(minY, c.y);
            maxY = Math.max(maxY, c.y);
          });
          const midX = Math.round((minX + maxX) / 2);
          const midY = Math.round((minY + maxY) / 2);

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-700" />
                    Unutarnji pregradni zidovi (Knauf W111 / W112)
                  </h3>
                  <p className="text-[11px] text-slate-500">Dvostrano obloženi pregradni zidovi s CW/UW podkonstrukcijom i zvučnom izolacijom</p>
                </div>
                <button
                  id="btn_add_partition"
                  type="button"
                  onClick={addPartitionWall}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Dodaj Pregradni Zid
                </button>
              </div>

              {/* Sub-Rooms Multi-Room Analysis */}
              {subRooms.length > 1 && (
                <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Grid className="w-4 h-4 text-indigo-600" />
                      Detektirana podjela na {subRooms.length} zasebne sobe:
                    </span>
                    <span className="text-[11px] font-mono text-indigo-700 font-bold">
                      Ukupna površina: {(subRooms.reduce((s, r) => s + r.areaM2, 0)).toFixed(2)} m²
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subRooms.map((sr, sIdx) => (
                      <div key={sr.id} className="p-2 bg-white rounded border border-indigo-100 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>{sr.name}</span>
                          <span className="text-indigo-600 font-mono">{sr.areaM2.toFixed(2)} m²</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {sr.assignedOpeningIds.length > 0 ? (
                            <span>Otvori u sobi: {sr.assignedOpeningIds.length}</span>
                          ) : (
                            <span className="text-amber-600 font-medium">⚠️ Nema dodijeljenih prozora/vrata</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Partition Conflict Alerts */}
              {partitionConflicts.length > 0 && (
                <div className="p-3 bg-amber-50 border-2 border-amber-400 rounded-lg text-amber-900 text-xs space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Konflikt: Pregradni zid se preklapa ili siječe s otvorom!</span>
                  </div>
                  {partitionConflicts.map((conf, cIdx) => (
                    <p key={cIdx} className="text-[11px] text-amber-800 pl-6 leading-relaxed">
                      • {conf.message}
                    </p>
                  ))}
                  <p className="text-[10px] text-amber-700 pl-6 pt-1 font-medium">
                    Prema DIN 18181 pregradni zid se ne smije spajati u staklo prozora ili okvir vrata. Potreban je odmak od minimalno 15 cm od dovratnika.
                  </p>
                </div>
              )}

              {config.partitionWalls.length === 0 ? (
                <div className="p-8 text-center bg-purple-50/50 rounded border border-dashed border-purple-300 text-purple-900 text-xs">
                  Nema dodanih pregradnih zidova. Kliknite gumb gore za dodavanje pregrade sa zvučnom izolacijom i obostranim pločama.
                </div>
              ) : (
                <div className="space-y-3">
                  {config.partitionWalls.map((part, pIdx) => {
                    const pLenM = (Math.hypot(part.endX - part.startX, part.endY - part.startY) / 100).toFixed(2);
                    return (
                      <div key={part.id} className="p-3.5 bg-slate-50 rounded-lg border border-slate-300 text-xs space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-700" />
                            <input
                              type="text"
                              value={part.name}
                              onChange={(e) => updatePartition(pIdx, { name: e.target.value })}
                              className="font-bold bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-900"
                            />
                            <span className="text-purple-700 font-mono font-bold">Duljina: {pLenM} m</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Quick Align Buttons */}
                            <button
                              type="button"
                              onClick={() => updatePartition(pIdx, { startX: midX, startY: minY, endX: midX, endY: maxY })}
                              className="text-[10px] px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded font-semibold transition-colors cursor-pointer"
                              title="Postavi pregradu točno po vertikalnoj sredini sobe"
                            >
                              Centriraj vertikalno (X={midX}cm)
                            </button>
                            <button
                              type="button"
                              onClick={() => removePartition(pIdx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded border border-slate-200">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Početak (X, Y) cm:</label>
                            <div className="flex gap-1">
                              <NumericInput
                                min={0}
                                max={3500}
                                value={part.startX}
                                onChange={(x) => updatePartition(pIdx, { startX: x })}
                                inputClassName="w-14 px-1 py-0.5 text-xs font-mono"
                              />
                              <NumericInput
                                min={0}
                                max={3500}
                                value={part.startY}
                                onChange={(y) => updatePartition(pIdx, { startY: y })}
                                inputClassName="w-14 px-1 py-0.5 text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Kraj (X, Y) cm:</label>
                            <div className="flex gap-1">
                              <NumericInput
                                min={0}
                                max={3500}
                                value={part.endX}
                                onChange={(x) => updatePartition(pIdx, { endX: x })}
                                inputClassName="w-14 px-1 py-0.5 text-xs font-mono"
                              />
                              <NumericInput
                                min={0}
                                max={3500}
                                value={part.endY}
                                onChange={(y) => updatePartition(pIdx, { endY: y })}
                                inputClassName="w-14 px-1 py-0.5 text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Profil:</label>
                            <select
                              value={part.profileType}
                              onChange={(e) => updatePartition(pIdx, { profileType: e.target.value as 'CW_50' | 'CW_75' | 'CW_100' })}
                              className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs"
                            >
                              <option value="CW_50">CW 50 / UW 50 (Debljina 7.5cm / 10cm)</option>
                              <option value="CW_75">CW 75 / UW 75 (Debljina 10cm / 12.5cm)</option>
                              <option value="CW_100">CW 100 / UW 100 (Debljina 12.5cm / 15cm)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Slojevi gipsa:</label>
                            <select
                              value={part.layers}
                              onChange={(e) => updatePartition(pIdx, { layers: parseInt(e.target.value) as 1 | 2 })}
                              className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs"
                            >
                              <option value="1">1 sloj obostrano (Knauf W111)</option>
                              <option value="2">2 sloja obostrano (Knauf W112 zvučni)</option>
                            </select>
                          </div>
                        </div>

                        {/* Doors in Partition Wall */}
                        <div className="pt-1 border-t border-slate-200">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                              <DoorClosed className="w-3.5 h-3.5 text-purple-600" />
                              Sobna vrata u pregradnom zidu (s UA ojačanjem i nadvratnikom):
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const currentOps = part.openings || [];
                                const newDoor: Opening = {
                                  id: `part_door_${Date.now()}`,
                                  wallIndex: 0,
                                  type: 'door',
                                  name: `Sobna Vrata ${currentOps.length + 1}`,
                                  width: 90,
                                  height: 205,
                                  distanceFromStart: 60,
                                  sillHeight: 0,
                                  doorJambType: 'ua_heavy'
                                };
                                updatePartition(pIdx, { openings: [...currentOps, newDoor] });
                              }}
                              className="text-[10px] px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded font-bold transition-colors cursor-pointer"
                            >
                              + Dodaj Vrata u Pregradu
                            </button>
                          </div>

                          {(!part.openings || part.openings.length === 0) ? (
                            <p className="text-[10px] text-slate-400 italic">Pregrada nema ugrađenih vrata (puni pregradni zid).</p>
                          ) : (
                            <div className="space-y-1.5">
                              {part.openings.map((dOp, dIdx) => (
                                <div key={dOp.id} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 text-xs">
                                  <span className="font-bold text-purple-900 w-24 truncate">{dOp.name}</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400">Širina:</span>
                                    <NumericInput
                                      min={60}
                                      max={150}
                                      value={dOp.width}
                                      onChange={(w) => {
                                        const ops = [...(part.openings || [])];
                                        ops[dIdx] = { ...ops[dIdx], width: w };
                                        updatePartition(pIdx, { openings: ops });
                                      }}
                                      inputClassName="w-12 px-1 py-0.5 text-xs font-mono"
                                    />
                                    <span className="text-[10px] text-slate-400">cm</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400">Visina:</span>
                                    <NumericInput
                                      min={180}
                                      max={240}
                                      value={dOp.height}
                                      onChange={(h) => {
                                        const ops = [...(part.openings || [])];
                                        ops[dIdx] = { ...ops[dIdx], height: h };
                                        updatePartition(pIdx, { openings: ops });
                                      }}
                                      inputClassName="w-12 px-1 py-0.5 text-xs font-mono"
                                    />
                                    <span className="text-[10px] text-slate-400">cm</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400">Udaljenost:</span>
                                    <NumericInput
                                      min={0}
                                      max={3000}
                                      value={dOp.distanceFromStart}
                                      onChange={(dist) => {
                                        const ops = [...(part.openings || [])];
                                        ops[dIdx] = { ...ops[dIdx], distanceFromStart: dist };
                                        updatePartition(pIdx, { openings: ops });
                                      }}
                                      inputClassName="w-12 px-1 py-0.5 text-xs font-mono"
                                    />
                                    <span className="text-[10px] text-slate-400">cm</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ops = (part.openings || []).filter((_, i) => i !== dIdx);
                                      updatePartition(pIdx, { openings: ops });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 ml-auto p-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ================= TAB 5: BOARDS & INSULATION ================= */}
        {activeTab === 'boards' && (
          <div className="space-y-4">
            {/* Board Type Selection */}
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Tip Knauf Gipskartonskih Ploča
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onChange({ ...config, boardType: 'standard' })}
                  className={`p-2.5 rounded border text-left transition-all ${
                    config.boardType === 'standard'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Standardna bijela (A / GKB)</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-bold">12.5 mm</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Suhi stambeni prostori (dnevni boravak, spavaće sobe).</p>
                </button>

                <button
                  type="button"
                  onClick={() => onChange({ ...config, boardType: 'moisture_resistant' })}
                  className={`p-2.5 rounded border text-left transition-all ${
                    config.boardType === 'moisture_resistant'
                      ? 'border-2 border-emerald-600 bg-emerald-50/70 text-emerald-900'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-emerald-600" />
                      Vlagootporna zelena (H2 / GKBI)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded font-bold">12.5 mm</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Impregnirana za kupaonice, kuhinje i vlažne prostore.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onChange({ ...config, boardType: 'fire_resistant' })}
                  className={`p-2.5 rounded border text-left transition-all ${
                    config.boardType === 'fire_resistant'
                      ? 'border-2 border-rose-600 bg-rose-50/70 text-rose-900'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-rose-600" />
                      Vatrootporna crvena (F / GKF)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded font-bold">12.5 mm</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Armirana vlaknima za kotlovnice i protupožarne zidove.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onChange({ ...config, boardType: 'acoustic_diamant' })}
                  className={`p-2.5 rounded border text-left transition-all ${
                    config.boardType === 'acoustic_diamant'
                      ? 'border-2 border-[#00529B] bg-blue-50/70 text-[#00529B]'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5 text-[#00529B]" />
                      Diamant Tvrda Akustična (Plava)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-200 text-[#00529B] rounded font-bold">Premium</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Maksimalna zvučna izolacija i otpornost na udarce.</p>
                </button>
              </div>
            </div>

            {/* Board Layers & Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded border border-slate-300">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                  Broj slojeva ploča:
                </label>
                <select
                  id="select_board_layers"
                  value={config.boardLayers}
                  onChange={(e) => onChange({ ...config, boardLayers: parseInt(e.target.value) as 1 | 2 })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                >
                  <option value="1">1 sloj (12.5 mm debljina) - Standard</option>
                  <option value="2">2 sloja (25.0 mm debljina) - Preporučeno za keramiku i zvuk</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                  Format ploča:
                </label>
                <select
                  id="select_board_size"
                  value={config.boardSize}
                  onChange={(e) => onChange({ ...config, boardSize: e.target.value as '2000x1250' | '2600x1200' | '2500x1200' })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                >
                  <option value="2000x1250">2000 × 1250 mm (2.50 m² - Standardni format)</option>
                  <option value="2600x1200">2600 × 1200 mm (3.12 m² - Cijela visina sobe)</option>
                  <option value="2500x1200">2500 × 1200 mm (3.00 m² - Standardni format)</option>
                </select>
              </div>
            </div>

            {/* Insulation section */}
            <div className="p-3.5 bg-amber-50/50 rounded border border-amber-300 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-amber-950">Mineralna Vuna (Izolacija)</div>
                  <div className="text-[11px] text-amber-800">Ispunjavanje šupljine unutar profila</div>
                </div>
                <input
                  id="toggle_insulation_check"
                  type="checkbox"
                  checked={config.hasInsulation}
                  onChange={(e) => onChange({ ...config, hasInsulation: e.target.checked })}
                  className="h-4 w-4 rounded text-[#00529B] focus:ring-[#00529B]"
                />
              </div>

              {config.hasInsulation && (
                <div className="pt-2 border-t border-amber-200">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                    Debljina i tip mineralne vune:
                  </label>
                  <select
                    value={config.insulationType}
                    onChange={(e) => onChange({ ...config, insulationType: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:border-[#00529B]"
                  >
                    <option value="mineral_wool_50">Staklena mineralna vuna Knauf Insulation 50 mm</option>
                    <option value="mineral_wool_75">Staklena mineralna vuna Knauf Insulation 75 mm</option>
                    <option value="mineral_wool_100">Staklena mineralna vuna Knauf Insulation 100 mm</option>
                    <option value="rockwool_50">Kamena vuna 50 mm (Visoka gustoća i protupožarnost)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Live Board Count & Cutting Preview Widget */}
            {(() => {
              const liveSummary = calculateDrywallMaterials(config);
              const bCalc = liveSummary.boardCalculation;
              if (!bCalc) return null;
              return (
                <div className="bg-blue-50/60 p-3.5 rounded border border-blue-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#00529B]" />
                      Proračun Količine & Rezanja Ploča
                    </span>
                    <span className="font-mono text-[11px] text-[#00529B] font-bold">
                      Ukupno: {bCalc.totalBoardsCount} kom ({(bCalc.totalBoardsCount * bCalc.singleBoardAreaM2).toFixed(1)} m²)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 font-bold block">Cijele ploče</span>
                      <span className="text-base font-bold text-emerald-700 font-mono">{bCalc.totalFullBoardsCount} kom</span>
                      <span className="text-[9px] text-slate-400 block">Puni format</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-amber-200">
                      <span className="text-[10px] text-amber-800 font-bold block">Ploče za rezanje</span>
                      <span className="text-base font-bold text-amber-700 font-mono">{bCalc.totalCutBoardsCount} kom</span>
                      <span className="text-[9px] text-slate-400 block">Doštukavanje/otvori</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-purple-200">
                      <span className="text-[10px] text-purple-800 font-bold block">Broj rezova</span>
                      <span className="text-base font-bold text-purple-700 font-mono">{bCalc.totalCutsEstimated} rezova</span>
                      <span className="text-[9px] text-slate-400 block">Otpad {bCalc.wastePercent}%</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-600 bg-white/80 p-2 rounded border border-blue-100 flex items-center justify-between">
                    <span>Knauf standard preporučuje L-rezove oko vrata radi sprječavanja pucanja.</span>
                    <span className="font-semibold text-emerald-700 font-mono">Iskoristivost: {bCalc.utilizationRatePercent}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
