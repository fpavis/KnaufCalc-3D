import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Wrench, 
  Sparkles, 
  Layers,
  ExternalLink,
  Info,
  Grid,
  Zap,
  ArrowRight,
  ShieldCheck,
  Flame,
  Droplets,
  Volume2
} from 'lucide-react';

interface KnaufGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StandardInfo {
  code: string;
  name: string;
  category: string;
  scope: string;
  quote: string;
  source: string;
  url: string;
}

export const STANDARDS_DATABASE: Record<string, StandardInfo> = {
  'DIN_18182_1': {
    code: 'DIN 18182-1 / HRN EN 14195',
    name: 'Pribor i metalni profili za suhu gradnju gipskartonskim pločama',
    category: 'Čelični profili i nosači',
    scope: 'Definira geometrijske tolerancije, debljinu lima (nominalno 0.6 mm za standardne CW/UW/CD/UD profile i 2.0 mm za UA profile), antikorozivnu pocinčanu zaštitu (Z100/Z140/Z275) i vlačnu čvrstoću čelika DX51D.',
    quote: '„Profili moraju biti izrađeni od pocinčanog čeličnog lima debljine minimalno 0.6 mm s prešanim ukrućenjima i H-otvorima za provođenje instalacijskih vodova bez slabljenja statičke nosivosti vertikale.“ — Knauf Tehnički priručnik Trockenbau.',
    source: 'Hrvatski zavod za norme (HZN) / DIN Deutsches Institut für Normung',
    url: 'https://www.knauf.hr/tehnicki-listovi/'
  },
  'HRN_EN_520': {
    code: 'HRN EN 520 / DIN 18180',
    name: 'Gipskartonske ploče — Definicije, zahtjevi i metode ispitivanja',
    category: 'Gipsane građevinske ploče',
    scope: 'Kategorizira ploče prema namjeni: Tip A (GKB standardna bijela), Tip H2 (GKBI impregnirana zelena, upijanje vode <10%), Tip F (GKF protupožarna s vlaknima), Tip DFIR (Diamant tvrda zvučna i protupožarna ploča visoke gustoće >800 kg/m³).',
    quote: '„Jezgra od kalcijevog sulfata dihidrata obostrano obložena čvrstim kartonom koji preuzima vlačna naprezanja pri savijanju. Uzdužni rubovi HRAK (poluobli kosi rub) osiguravaju optimalno punjenje masom za fuge bez pucanja.“ — EN 520 Standard.',
    source: 'Europska norma EN 520:2009 / DIN 18180:2014',
    url: 'https://www.knauf.hr/proizvodi/gipsane-ploce/'
  },
  'DIN_18181': {
    code: 'DIN 18181 / HRN DIN 18181',
    name: 'Građenje u suhoj gradnji gipskartonskim sustavima — Izvedba',
    category: 'Pravila ugradnje i tehnologija',
    scope: 'Propisuje maksimalne razmake potkonstrukcije (400 mm ili 625 mm), raspored i razmake vijaka TN (250 mm za 1. sloj, 200 mm za 2. sloj), pravila izvođenja dilatacijskih fuga (na svakih 15 m dužine) i pravila obrade spojeva (kvaliteta Q1 do Q4).',
    quote: '„Gipsane ploče se moraju postavljati s pomaknutim poprečnim fugama (min. 400 mm). Križni spojevi (križne fuge) su strogo zabranjeni. Vijci se moraju upustiti 1 mm ispod razine kartona bez probijanja vanjskog sloja kartona.“ — DIN 18181:2019.',
    source: 'DIN 18181:2019-09 Gipsplatten im Hochbau - Verarbeitung',
    url: 'https://www.knauf.hr/sustavi/'
  },
  'HRN_EN_13964': {
    code: 'HRN EN 13964 / DIN 18168-1',
    name: 'Ovješeni spušteni stropovi — Zahtjevi i metode ispitivanja',
    category: 'Stropni sustavi i ovjesi',
    scope: 'Definira dopuštena opterećenja nosača, sidrenih ovjesa s oprugom (nosivost do 0.25 kN / 25 kg po točki), Nonius ovjesa (do 0.40 kN / 40 kg po točki) i klasu otpornosti na deformaciju 1/500 raspona.',
    quote: '„Priključak na masivni strop mora biti izveden isključivo čeličnim stropnim klinovima (DN6) ili metalnim sidrima. Korištenje plastičnih tipli za spuštene stropove je strogo zabranjeno zbog opasnosti od popuštanja u slučaju požara.“ — Tehnička smjernica D11.',
    source: 'HRN EN 13964:2014 Spušteni stropovi',
    url: 'https://www.knauf.hr/sustavi/spusteni-stropovi/'
  },
  'HRN_EN_13501_1': {
    code: 'HRN EN 13501-1 / DIN 4102-4',
    name: 'Požarna klasifikacija građevnih proizvoda i građevnih elemenata',
    category: 'Protupožarna zaštita (F30 - F120)',
    scope: 'Klasificira reakciju na požar materijala (Knauf ploče klase A2-s1, d0 - negorivo) i otpornost pregradnih zidova i stropova na požar: EI 30 (W111), EI 60 / EI 90 (W112), EI 120 (W113).',
    quote: '„Pregradni zid W112 s 2x12.5mm Knauf Red GKF pločama i mineralnom vunom gustoće min. 30 kg/m³ osigurava vatrootpornost EI 90 (90 minuta zadržavanja požara i dima).“ — Katalog protupožarne zaštite Knauf.',
    source: 'Europski standard EN 13501-1 / DIN 4102',
    url: 'https://www.knauf.hr/sustavi/protupozarni-sustavi/'
  },
  'HRN_EN_ISO_717_1': {
    code: 'HRN EN ISO 717-1 / DIN 4109',
    name: 'Akustika — Vrednovanje zvučne izolacije u zgradama',
    category: 'Zvučna i akustična izolacija',
    scope: 'Mjeri indeks zvučne izolacije Rw (C; Ctr) u decibelima (dB). Suhomontažni zidovi djeluju na principu masa-opruga-masa (ploča - mineralna vuna - ploča), pružajući zvučnu izolaciju od 48 dB (W111) do 62 dB (W112 s Knauf Diamant pločama).',
    quote: '„Obvezno je postavljanje akustične brtvene trake (Dichtungsband) na sve priključne UW i UD profile. Nepostavljanje trake stvara akustični most koji smanjuje zvučnu izolaciju zida za 8 do 12 dB.“ — Knauf Akustik Buch.',
    source: 'HRN EN ISO 717-1:2021 / DIN 4109 Zvučna izolacija',
    url: 'https://www.knauf.hr/sustavi/zvucna-izolacija/'
  }
};

// Reusable Interactive Standard Badge with Hover/Click Tooltip
export const StandardBadge: React.FC<{ stdKey: string; compact?: boolean }> = ({ stdKey, compact }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const info = STANDARDS_DATABASE[stdKey];

  if (!info) return null;

  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setShowTooltip(prev => !prev)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1 font-mono font-bold rounded cursor-pointer transition-all border ${
          compact
            ? 'px-1.5 py-0.5 text-[10px] bg-blue-50 text-[#00529B] border-blue-200 hover:bg-blue-100'
            : 'px-2 py-0.5 text-[11px] bg-slate-100 text-slate-800 border-slate-300 hover:bg-blue-50 hover:text-[#00529B] hover:border-blue-300'
        }`}
      >
        <ShieldCheck className="w-3 h-3 text-[#00529B] shrink-0" />
        <span className="truncate">{info.code}</span>
        <Info className="w-2.5 h-2.5 opacity-60 ml-0.5" />
      </button>

      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-2 w-80 sm:w-96 p-3 bg-slate-900 text-white rounded-lg shadow-2xl border border-slate-700 text-xs z-50 animate-fadeIn pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
            <span className="font-bold text-blue-300 font-mono text-[11px] flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {info.code}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/80 text-blue-200 rounded font-semibold">
              {info.category}
            </span>
          </div>
          <div className="font-bold text-slate-100 text-xs mb-1">
            {info.name}
          </div>
          <p className="text-[11px] text-slate-300 mb-2 leading-relaxed">
            {info.scope}
          </p>
          <div className="p-2 bg-slate-800/80 rounded border border-slate-700 text-[10px] text-amber-200 italic mb-2 leading-relaxed">
            {info.quote}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            <span>Izvor: {info.source}</span>
            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold underline"
            >
              <span>Knauf priručnik</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      )}
    </span>
  );
};

export const KnaufGuideModal: React.FC<KnaufGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'systems' | 'doors' | 'standards'>('profiles');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-300 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00529B] text-white rounded-lg shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg uppercase tracking-tight flex items-center gap-2">
                Stručni Vodič: Pravila, Tehnologija i Norme Suhe Gradnje
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                <span>Prema Knauf tehničkim listovima i standardima:</span>
                <StandardBadge stdKey="DIN_18181" compact />
                <StandardBadge stdKey="DIN_18182_1" compact />
                <StandardBadge stdKey="HRN_EN_520" compact />
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-300 bg-slate-100 p-1.5 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md font-bold uppercase tracking-wider transition-all ${
              activeTab === 'profiles'
                ? 'bg-[#00529B] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>1. CW/UW vs CD/UD</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('systems')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md font-bold uppercase tracking-wider transition-all ${
              activeTab === 'systems'
                ? 'bg-[#00529B] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Zidovi & Stropovi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('doors')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md font-bold uppercase tracking-wider transition-all ${
              activeTab === 'doors'
                ? 'bg-[#00529B] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>3. Otvori & UA Profili</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('standards')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md font-bold uppercase tracking-wider transition-all ${
              activeTab === 'standards'
                ? 'bg-[#00529B] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>4. DIN & HRN EN Norme</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700 leading-relaxed max-h-[70vh]">
          
          {/* ================= TAB 1: CW/UW vs CD/UD PROFILES WITH SVG SCHEMATICS ================= */}
          {activeTab === 'profiles' && (
            <div className="space-y-6">
              <div className="p-3.5 bg-blue-50/80 rounded-lg border border-blue-200 text-blue-950">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#00529B] flex items-center gap-1.5 mb-1">
                  <Info className="w-4 h-4 text-[#00529B]" />
                  Glavna Razlika: Zidni profili (CW/UW) vs. Stropni & Obložni profili (CD/UD)
                </h4>
                <p className="text-xs leading-normal">
                  Česta greška u suhoj gradnji je miješanje profila za pregradne zidove i spuštene stropove. 
                  Sustavi se razlikuju po geometriji poprečnog presjeka, nosivosti, savijenim rubovima i načinu sidrenja.
                  Svi profili izrađeni su prema <StandardBadge stdKey="DIN_18182_1" compact /> od visokokvalitetnog pocinčanog čeličnog lima.
                </p>
              </div>

              {/* CW vs UW Section */}
              <div className="border border-slate-300 rounded-xl p-4 bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#00529B] text-white rounded text-xs font-mono font-bold">CW / UW</span>
                      Zidni Profili (Pregradni Zidovi & Samostojeće Zidne Obloge)
                    </h4>
                    <p className="text-[11px] text-slate-500">Knauf W111, W112, W115, W625 sustavi pregrada</p>
                  </div>
                  <StandardBadge stdKey="DIN_18182_1" />
                </div>

                {/* Visual SVG Diagram for CW vs UW */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {/* CW Profile Card */}
                  <div className="bg-white p-3 rounded-md border border-slate-300 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#00529B] font-mono">CW Profil (Vertikala)</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">C-oblik 0.6mm</span>
                    </div>

                    {/* SVG Graphic for CW */}
                    <div className="flex justify-center p-2 bg-slate-100 rounded border border-slate-200">
                      <svg viewBox="0 0 180 120" className="w-44 h-28">
                        {/* Base Steel CW C-section */}
                        <path d="M 50,20 L 35,20 L 35,100 L 50,100" fill="none" stroke="#00529B" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                        {/* Folded inner stiffening flanges (C lips) */}
                        <path d="M 50,20 L 50,30" fill="none" stroke="#00529B" strokeWidth="6" strokeLinecap="round" />
                        <path d="M 50,100 L 50,90" fill="none" stroke="#00529B" strokeWidth="6" strokeLinecap="round" />
                        
                        {/* H-Punch Cable Cutout in the web */}
                        <rect x="30" y="50" width="10" height="20" rx="3" fill="#F8FAFC" stroke="#F59E0B" strokeWidth="2" strokeDasharray="3,2" />
                        
                        {/* Dimension annotations */}
                        <line x1="25" y1="20" x2="25" y2="100" stroke="#64748B" strokeWidth="1" />
                        <text x="18" y="65" fill="#0F172A" fontSize="9" fontWeight="bold" textAnchor="middle">50/75/100</text>
                        
                        <line x1="35" y1="112" x2="50" y2="112" stroke="#64748B" strokeWidth="1" />
                        <text x="42" y="118" fill="#0F172A" fontSize="8" textAnchor="middle">50mm</text>
                        
                        {/* Labels */}
                        <text x="110" y="30" fill="#00529B" fontSize="9" fontWeight="bold">Savijeni rubovi (C-usne)</text>
                        <text x="110" y="42" fill="#64748B" fontSize="8">Daju visoku krutost vertikali</text>
                        <text x="110" y="62" fill="#D97706" fontSize="9" fontWeight="bold">H-otvor za kabele</text>
                        <text x="110" y="74" fill="#64748B" fontSize="8">Provod elektro bužira</text>
                        <text x="110" y="95" fill="#0F172A" fontSize="8">Debljina lima: 0.6 mm</text>
                      </svg>
                    </div>

                    <ul className="text-[11px] space-y-1 text-slate-600">
                      <li>• <strong>Namjena:</strong> Okomita nosiva vertikala pregradnih zidova i predzidnih obloga.</li>
                      <li>• <strong>Dimenzije širine baze:</strong> 50 mm (CW 50), 75 mm (CW 75), 100 mm (CW 100).</li>
                      <li>• <strong>Pravilo ugradnje:</strong> CW profil se reže <strong>1.5 cm kraće</strong> od visine prostorije i samo ulaže u UW profil (ne vijča se, kako bi strop mogao elastično raditi).</li>
                    </ul>
                  </div>

                  {/* UW Profile Card */}
                  <div className="bg-white p-3 rounded-md border border-slate-300 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#00529B] font-mono">UW Profil (Vodilica)</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-bold">U-oblik 0.6mm</span>
                    </div>

                    {/* SVG Graphic for UW */}
                    <div className="flex justify-center p-2 bg-slate-100 rounded border border-slate-200">
                      <svg viewBox="0 0 180 120" className="w-44 h-28">
                        {/* Acoustic tape underneath */}
                        <rect x="25" y="96" width="60" height="8" fill="#F59E0B" rx="1" />
                        <text x="55" y="115" fill="#D97706" fontSize="7" fontWeight="bold" textAnchor="middle">PE brtvena traka</text>

                        {/* Base Steel UW U-section */}
                        <path d="M 30,30 L 30,95 L 80,95 L 80,30" fill="none" stroke="#00529B" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Anchoring fastener dot */}
                        <circle cx="55" cy="95" r="4" fill="#E11D48" />
                        
                        {/* Labels */}
                        <text x="95" y="35" fill="#00529B" fontSize="9" fontWeight="bold">Ravne bočne stranice</text>
                        <text x="95" y="47" fill="#64748B" fontSize="8">Glatke, visina 40mm</text>
                        <text x="95" y="65" fill="#E11D48" fontSize="9" fontWeight="bold">Sidrenje tiplama</text>
                        <text x="95" y="77" fill="#64748B" fontSize="8">U pod/strop svakih 80cm</text>
                        <text x="95" y="95" fill="#D97706" fontSize="9" fontWeight="bold">Brtvena traka</text>
                        <text x="95" y="105" fill="#64748B" fontSize="8">Sprječava zvučne mostove</text>
                      </svg>
                    </div>

                    <ul className="text-[11px] space-y-1 text-slate-600">
                      <li>• <strong>Namjena:</strong> Vodoravna podna i stropna vodilica koja definira tlocrtni položaj zida.</li>
                      <li>• <strong>Dimenzije širine:</strong> 50 mm (UW 50), 75 mm (UW 75), 100 mm (UW 100).</li>
                      <li>• <strong>Pravilo ugradnje:</strong> Na poleđinu se obavezno lijepi akustična brtvena traka i učvršćuje udarnim tiplama svakih max. 80-100 cm.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* CD vs UD Section */}
              <div className="border border-slate-300 rounded-xl p-4 bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-sky-600 text-white rounded text-xs font-mono font-bold">CD / UD</span>
                      Stropni & Obložni Profili (Spušteni Stropovi & Plitke Zidne Obloge)
                    </h4>
                    <p className="text-[11px] text-slate-500">Knauf D112, D113 stropovi i W623 plitke zidne obloge na nosačima</p>
                  </div>
                  <StandardBadge stdKey="HRN_EN_13964" />
                </div>

                {/* Visual SVG Diagram for CD vs UD */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {/* CD 60/27 Profile Card */}
                  <div className="bg-white p-3 rounded-md border border-slate-300 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-sky-800 font-mono">CD 60/27 Profil (Montažni/Glavni)</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-sky-100 text-sky-800 rounded font-bold">C-profil 60×27mm</span>
                    </div>

                    {/* SVG Graphic for CD 60/27 */}
                    <div className="flex justify-center p-2 bg-slate-100 rounded border border-slate-200">
                      <svg viewBox="0 0 180 120" className="w-44 h-28">
                        {/* Base Steel CD section with stiffener ribs */}
                        <path d="M 30,35 L 30,85 L 85,85 L 85,35" fill="none" stroke="#0284C7" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                        {/* Inward rolled lips for spring anchors */}
                        <path d="M 30,35 L 38,35 L 38,42" fill="none" stroke="#0284C7" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M 85,35 L 77,35 L 77,42" fill="none" stroke="#0284C7" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                        
                        {/* Ribs in web and flanges */}
                        <line x1="57" y1="83" x2="57" y2="87" stroke="#38BDF8" strokeWidth="2" />
                        <line x1="43" y1="83" x2="43" y2="87" stroke="#38BDF8" strokeWidth="2" />
                        <line x1="71" y1="83" x2="71" y2="87" stroke="#38BDF8" strokeWidth="2" />

                        {/* Labels */}
                        <text x="98" y="32" fill="#0284C7" fontSize="9" fontWeight="bold">Uvijeni rubovi</text>
                        <text x="98" y="44" fill="#64748B" fontSize="8">Za prihvat sidrenog ovjesa</text>
                        <text x="98" y="60" fill="#0284C7" fontSize="9" fontWeight="bold">Širina: 60 mm</text>
                        <text x="98" y="72" fill="#64748B" fontSize="8">Visina bočne stranice: 27 mm</text>
                        <text x="98" y="88" fill="#0F172A" fontSize="9" fontWeight="bold">Križne spojnice</text>
                        <text x="98" y="100" fill="#64748B" fontSize="8">Za križanje u 2 razine (D112)</text>
                      </svg>
                    </div>

                    <ul className="text-[11px] space-y-1 text-slate-600">
                      <li>• <strong>Namjena:</strong> Glavni nosivi i poprečni montažni profili u spuštenim stropovima ili vertikale kod plitkih zidnih obloga (W623).</li>
                      <li>• <strong>Dimenzije:</strong> Standardna širina 60 mm, visina 27 mm.</li>
                      <li>• <strong>Montaža:</strong> Vješa se sidrenim ovjesima s oprugom, Nonius ovjesima ili direktnim nosačima.</li>
                    </ul>
                  </div>

                  {/* UD 28/27 Profile Card */}
                  <div className="bg-white p-3 rounded-md border border-slate-300 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-sky-800 font-mono">UD 28/27 Profil (Obodni)</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-bold">U-profil 28×27mm</span>
                    </div>

                    {/* SVG Graphic for UD 28/27 */}
                    <div className="flex justify-center p-2 bg-slate-100 rounded border border-slate-200">
                      <svg viewBox="0 0 180 120" className="w-44 h-28">
                        {/* Wall line */}
                        <line x1="20" y1="20" x2="20" y2="100" stroke="#94A3B8" strokeWidth="4" />
                        <rect x="22" y="25" width="6" height="65" fill="#F59E0B" />
                        <text x="14" y="65" fill="#64748B" fontSize="7" fontWeight="bold" textAnchor="middle" transform="rotate(-90, 14, 65)">MASIVNI ZID</text>

                        {/* Base Steel UD section */}
                        <path d="M 60,35 L 28,35 L 28,85 L 60,85" fill="none" stroke="#0284C7" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Anchoring fastener dot */}
                        <circle cx="28" cy="60" r="3.5" fill="#E11D48" />

                        {/* Labels */}
                        <text x="75" y="35" fill="#0284C7" fontSize="9" fontWeight="bold">Obodni profil</text>
                        <text x="75" y="47" fill="#64748B" fontSize="8">Montira se po cijelom perimetru</text>
                        <text x="75" y="65" fill="#E11D48" fontSize="9" fontWeight="bold">Tiplanje u zid</text>
                        <text x="75" y="77" fill="#64748B" fontSize="8">Razmak tipli max. 80 cm</text>
                        <text x="75" y="95" fill="#0F172A" fontSize="9" fontWeight="bold">Širina baze: 28 mm</text>
                        <text x="75" y="105" fill="#64748B" fontSize="8">Prihvaća CD 60/27 profil</text>
                      </svg>
                    </div>

                    <ul className="text-[11px] space-y-1 text-slate-600">
                      <li>• <strong>Namjena:</strong> Zidni rubni profil koji se postavlja horizontalno po obodu prostorije za vođenje CD profila spuštenog stropa.</li>
                      <li>• <strong>Dimenzije:</strong> Širina baze 28 mm, visina bočnih krila 27 mm.</li>
                      <li>• <strong>Brtvljenje:</strong> Obavezno lijepljenje PE akustične trake na dodirnoj plohi sa zidom.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: KNAUF WALL & CEILING SYSTEMS ================= */}
          {activeTab === 'systems' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* D112 Ceiling */}
                <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-sky-950 font-mono">Knauf D112 (Dvorazinski Križni Strop)</span>
                    <span className="text-[10px] px-2 py-0.5 bg-sky-200 text-sky-900 rounded font-bold">Standard #1</span>
                  </div>
                  <p className="text-[11px] text-sky-900 leading-relaxed">
                    Sastoji se od primarnih (glavnih) CD profila ovješenih na strop i sekundarnih (montažnih) CD profila u donjoj razini, spojenih <strong>križnim spojnicama</strong>.
                  </p>
                  <div className="bg-white p-2.5 rounded border border-sky-200 text-[11px] text-slate-700 space-y-1">
                    <div>• <strong>Razmak primarnih CD:</strong> 900 - 1000 mm</div>
                    <div>• <strong>Razmak točaka ovjesa:</strong> max. 800 - 900 mm (čelični klinovi DN6)</div>
                    <div>• <strong>Razmak montažnih CD:</strong> 500 mm (1 sloj gipsa) / 400 mm (2 sloja gipsa)</div>
                  </div>
                </div>

                {/* D113 Ceiling */}
                <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 font-mono">Knauf D113 (Jednorazinski Strop)</span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold">Plitko spuštanje</span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Svi CD 60/27 profili leže u jednoj razini, uvučeni u obodne UD profile i vješani direktnim nosačima. Minimalno smanjenje visine stropa (već od 4-5 cm).
                  </p>
                  <div className="bg-white p-2.5 rounded border border-slate-200 text-[11px] text-slate-700 space-y-1">
                    <div>• <strong>Razmak nosača:</strong> 500 mm ili 400 mm</div>
                    <div>• <strong>Učvršćenje:</strong> Direktni nosač CD 60 s vijcima LN 3.5x9.5 mm</div>
                  </div>
                </div>

                {/* W111 / W112 Partition Wall */}
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-950 font-mono">Knauf W111 / W112 (Pregradni Zidovi)</span>
                    <span className="text-[10px] px-2 py-0.5 bg-purple-200 text-purple-900 rounded font-bold">Pregrade</span>
                  </div>
                  <p className="text-[11px] text-purple-900 leading-relaxed">
                    Samostojeći pregradni zid s CW vertikalama u UW vodilicama i ispunom mineralnom vunom.
                  </p>
                  <div className="bg-white p-2.5 rounded border border-purple-200 text-[11px] text-slate-700 space-y-1">
                    <div>• <strong>W111:</strong> 1 sloj ploča sa svake strane (debljina zida 75 - 125 mm)</div>
                    <div>• <strong>W112:</strong> 2 sloja ploča sa svake strane (visoka zvučna izolacija do 58 dB, vatrootpornost EI 90)</div>
                  </div>
                </div>

                {/* W625 Freestanding Lining */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-950 font-mono">Knauf W625 (Samostojeći Predzid)</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-bold">Izravnavanje</span>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    Zidna obloga koja se ne sidri u stari kosi/neravni zid. CW vertikale stoje slobodno u UW vodilicama koje su postavljene po laserskoj 90° liniji.
                  </p>
                  <div className="bg-white p-2.5 rounded border border-emerald-200 text-[11px] text-slate-700 space-y-1">
                    <div>• <strong>Prednost:</strong> Idealno za renovacije s nepravilnim kutovima i prostor za cijevi/instalacije</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: OPENINGS, DOORS & UA PROFILES ================= */}
          {activeTab === 'doors' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/80 rounded-lg border border-amber-200 text-amber-950">
                <h4 className="font-bold text-xs uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  Statika i Ojačanja Oko Vrata: Pravila za UA Profile
                </h4>
                <p className="text-xs leading-normal">
                  Standardni CW profili od 0.6 mm nisu predviđeni za dinamička opterećenja otvaranja i zatvaranja teških sobnih ili ulaznih vrata. 
                  Kod vrata težine krila &gt; 25 kg ili širine &gt; 90 cm obavezna je ugradnja ojačanih <strong>UA profila debljine 2.0 mm</strong>.
                </p>
              </div>

              {/* Door Framing Diagram */}
              <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs space-y-3">
                <h5 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                  Pravila Montaže Nadvratnika i Dovratnika
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                    <strong className="text-[#00529B] block text-xs">1. Priključni kutnici za pod i strop:</strong>
                    <p className="text-[11px] text-slate-600">
                      UA profil se sidri u armirani beton poda i stropa pomoću čeličnih kutnika i udarnih tipli M8. Ne sidri se samo u UW vodilicu!
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                    <strong className="text-[#00529B] block text-xs">2. Nadvratnik i raster ploča:</strong>
                    <p className="text-[11px] text-slate-600">
                      Iznad vrata se umeće preokrenuti UW profil. Poprečni spoj gipsanih ploča <strong>nikada ne smije biti u liniji vertikale dovratnika</strong> (obavezan pomak fuge min. 15 cm kako bi se spriječile pukotine od vibracija).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: COMPREHENSIVE DIN & HRN EN STANDARDS REFERENCE ================= */}
          {activeTab === 'standards' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Službeni Standardi i Norme Suhe Gradnje
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Kliknite na bilo koju normu za detaljan opis opsega, citat iz knjige standarda i tehničku referencu.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {Object.entries(STANDARDS_DATABASE).map(([key, item]) => (
                  <div key={key} className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 hover:border-[#00529B] transition-colors space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <StandardBadge stdKey={key} />
                        <span className="font-bold text-slate-900 text-xs">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-[#00529B] rounded">
                        {item.category}
                      </span>
                    </div>

                    <p className="text-slate-600 text-xs">
                      {item.scope}
                    </p>

                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded text-amber-950 italic text-[11px]">
                      {item.quote}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Nadležna institucija: <strong>{item.source}</strong></span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00529B] font-bold hover:underline flex items-center gap-1"
                      >
                        <span>Otvori Knauf dokumentaciju</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-300 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            KnaufCalc Pro Sustavi suhe gradnje sukladni s DIN 18181 i HRN EN 14195
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#00529B] text-white hover:bg-blue-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
          >
            Zatvori vodič
          </button>
        </div>
      </div>
    </div>
  );
};
