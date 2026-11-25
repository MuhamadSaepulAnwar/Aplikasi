import React, { useRef, useState } from 'react';
import {
  DesignPlacement,
  GarmentStyle,
  Order,
  ShirtProductionSpec,
  ShopProfile,
} from '../types';
import {
  DEFAULT_BACK_PLACEMENT,
  DEFAULT_FRONT_PLACEMENT,
  getShirtSizeTotals,
  SHIRT_POLA_OPTIONS,
  SHIRT_SIZE_LABELS,
} from '../lib/format';

interface ShirtPurchaseOrderSheetProps {
  order: Order;
  shop: ShopProfile;
  spec: ShirtProductionSpec;
  displayInvoiceNumber: string;
}

function formatDateSlashShort(iso: string): string {
  if (!iso || iso.length < 10) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(-2)}`;
}

function getContrastStroke(hex: string): string {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return '#111827';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.25 ? '#94A3B8' : '#111827';
}

export interface VectorGarmentMockupProps {
  side: 'front' | 'back';
  garmentStyle: GarmentStyle;
  shirtColorHex: string;
  sleeveColorHex?: string;
  designDataUrl?: string;
  placement?: DesignPlacement;
  interactive?: boolean;
  onChangePlacement?: (next: DesignPlacement) => void;
  className?: string;
}

export const VectorGarmentMockup: React.FC<VectorGarmentMockupProps> = ({
  side,
  garmentStyle,
  shirtColorHex,
  sleeveColorHex = '#1E293B',
  designDataUrl,
  placement,
  interactive = false,
  onChangePlacement,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const fill = /^#[0-9a-fA-F]{6}$/.test(shirtColorHex) ? shirtColorHex : '#94A3B8';
  const sleeveFill = /^#[0-9a-fA-F]{6}$/.test(sleeveColorHex) ? sleeveColorHex : '#1E293B';
  const stroke = getContrastStroke(fill);
  const sleeveStroke = getContrastStroke(sleeveFill);

  const activePlacement: DesignPlacement =
    placement || (side === 'front' ? DEFAULT_FRONT_PLACEMENT : DEFAULT_BACK_PLACEMENT);

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!interactive || !onChangePlacement || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(10, Math.min(90, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(10, Math.min(90, Math.round(((clientY - rect.top) / rect.height) * 100)));
    onChangePlacement({ ...activePlacement, x, y });
  };

  const renderGarmentPaths = () => {
    // 1. PANJANG (Long Sleeve T-Shirt)
    if (garmentStyle === 'panjang') {
      return (
        <g>
          {/* Main Body + Long Sleeves */}
          <path
            d={
              side === 'front'
                ? 'M100,26 Q140,56 180,26 L210,38 L266,184 L244,193 L204,104 L204,284 L76,284 L76,104 L36,193 L14,184 L70,38 Z'
                : 'M100,26 Q140,38 180,26 L210,38 L266,184 L244,193 L204,104 L204,284 L76,284 L76,104 L36,193 L14,184 L70,38 Z'
            }
            fill={fill}
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Wrist Cuffs */}
          <path d="M18,175 L39,184" fill="none" stroke={stroke} strokeWidth="1.4" />
          <path d="M262,175 L241,184" fill="none" stroke={stroke} strokeWidth="1.4" />
          {/* Armhole Seams */}
          <path d="M76,104 Q84,68 72,38" fill="none" stroke={stroke} strokeWidth="1.3" />
          <path d="M204,104 Q196,68 208,38" fill="none" stroke={stroke} strokeWidth="1.3" />
          {/* Collar */}
          {side === 'front' ? (
            <>
              <path
                d="M98,26 Q140,66 182,26 L176,20 Q140,53 104,20 Z"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.4"
              />
              <path d="M104,20 Q140,39 176,20" fill="none" stroke={stroke} strokeWidth="1.2" />
            </>
          ) : (
            <path
              d="M99,26 Q140,40 181,26 L176,20 Q140,32 104,20 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth="1.4"
            />
          )}
        </g>
      );
    }

    // 2. RAGLAN (3/4 Contrast Sleeves + Diagonal Raglan Seam)
    if (garmentStyle === 'raglan') {
      return (
        <g>
          {/* Body */}
          <path
            d={
              side === 'front'
                ? 'M100,26 Q140,56 180,26 L204,108 L204,284 L76,284 L76,108 Z'
                : 'M100,26 Q140,38 180,26 L204,108 L204,284 L76,284 L76,108 Z'
            }
            fill={fill}
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Left Raglan Sleeve */}
          <path
            d="M100,26 L70,38 L18,138 L44,152 L76,108 Z"
            fill={sleeveFill}
            stroke={sleeveStroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Right Raglan Sleeve */}
          <path
            d="M180,26 L210,38 L262,138 L236,152 L204,108 Z"
            fill={sleeveFill}
            stroke={sleeveStroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Raglan Collar Rib (contrast sleeve color) */}
          {side === 'front' ? (
            <>
              <path
                d="M98,26 Q140,66 182,26 L176,20 Q140,53 104,20 Z"
                fill={sleeveFill}
                stroke={sleeveStroke}
                strokeWidth="1.4"
              />
              <path d="M104,20 Q140,39 176,20" fill="none" stroke={stroke} strokeWidth="1.2" />
            </>
          ) : (
            <path
              d="M99,26 Q140,40 181,26 L176,20 Q140,32 104,20 Z"
              fill={sleeveFill}
              stroke={sleeveStroke}
              strokeWidth="1.4"
            />
          )}
        </g>
      );
    }

    // 3. OVERSIZE (Boxy, Drop Shoulder, Wider & Longer Sleeves, Thick Collar Rib)
    if (garmentStyle === 'oversize') {
      return (
        <g>
          <path
            d={
              side === 'front'
                ? 'M98,26 Q140,54 182,26 L222,42 L268,118 L230,148 L214,124 L214,286 L66,286 L66,124 L50,148 L12,118 L58,42 Z'
                : 'M98,26 Q140,38 182,26 L222,42 L268,118 L230,148 L214,124 L214,286 L66,286 L66,124 L50,148 L12,118 L58,42 Z'
            }
            fill={fill}
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Drop Shoulder Seams */}
          <path d="M66,124 Q72,82 54,48" fill="none" stroke={stroke} strokeWidth="1.4" />
          <path d="M214,124 Q208,82 226,48" fill="none" stroke={stroke} strokeWidth="1.4" />
          {/* Thick Oversize Rib Collar */}
          {side === 'front' ? (
            <>
              <path
                d="M95,26 Q140,68 185,26 L178,18 Q140,52 102,18 Z"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.5"
              />
              <path d="M102,18 Q140,38 178,18" fill="none" stroke={stroke} strokeWidth="1.2" />
            </>
          ) : (
            <path
              d="M96,26 Q140,42 184,26 L178,18 Q140,31 102,18 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth="1.5"
            />
          )}
        </g>
      );
    }

    // 4. HOODIE (Hood + Long Sleeves + Rib Cuffs/Waistband + Kangaroo Pocket)
    if (garmentStyle === 'hoodie') {
      return (
        <g>
          {/* Main Body & Long Sleeves */}
          <path
            d="M100,46 L208,52 L266,192 L242,202 L204,116 L204,284 L76,284 L76,116 L38,202 L14,192 L72,52 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Armhole Seams */}
          <path d="M76,116 Q82,80 74,52" fill="none" stroke={stroke} strokeWidth="1.3" />
          <path d="M204,116 Q198,80 206,52" fill="none" stroke={stroke} strokeWidth="1.3" />
          {/* Sleeve & Waist Rib Bands */}
          <path d="M19,182 L41,192" fill="none" stroke={stroke} strokeWidth="1.5" />
          <path d="M261,182 L239,192" fill="none" stroke={stroke} strokeWidth="1.5" />
          <path d="M76,266 L204,266" fill="none" stroke={stroke} strokeWidth="1.5" />
          {/* Hood */}
          {side === 'front' ? (
            <g>
              <path
                d="M100,46 Q94,14 140,10 Q186,14 180,46 Q160,64 140,64 Q120,64 100,46 Z"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              {/* Inner Hood Opening */}
              <path
                d="M112,44 Q112,22 140,20 Q168,22 168,44 Q152,58 140,58 Q128,58 112,44 Z"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.3"
              />
              {/* Drawstrings */}
              <path d="M130,58 L128,96" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
              <path d="M150,58 L152,96" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
              {/* Kangaroo Pocket */}
              <path
                d="M102,208 L178,208 L190,264 L90,264 Z"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </g>
          ) : (
            <g>
              {/* Back Folded Hood */}
              <path
                d="M100,46 L104,12 Q140,6 176,12 L180,46 Q140,86 100,46 Z"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M140,9 L140,65" fill="none" stroke={stroke} strokeWidth="1.2" />
            </g>
          )}
        </g>
      );
    }

    // 5. POLO (Folded Collar + Placket + Buttons)
    if (garmentStyle === 'polo') {
      return (
        <g>
          {/* Shirt Body + Short Sleeves */}
          <path
            d={
              side === 'front'
                ? 'M100,28 Q140,48 180,28 L212,42 L258,88 L228,136 L204,120 L204,284 L76,284 L76,120 L52,136 L22,88 L68,42 Z'
                : 'M100,28 Q140,38 180,28 L212,42 L258,88 L228,136 L204,120 L204,284 L76,284 L76,120 L52,136 L22,88 L68,42 Z'
            }
            fill={fill}
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Armhole & Sleeve Rib Cuffs */}
          <path d="M76,120 Q84,80 70,42" fill="none" stroke={stroke} strokeWidth="1.3" />
          <path d="M204,120 Q196,80 210,42" fill="none" stroke={stroke} strokeWidth="1.3" />
          <path d="M27,96 L56,129" fill="none" stroke={stroke} strokeWidth="1.2" />
          <path d="M253,96 L224,129" fill="none" stroke={stroke} strokeWidth="1.2" />

          {side === 'front' ? (
            <g>
              {/* Polo Placket */}
              <rect
                x="133"
                y="45"
                width="14"
                height="48"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.3"
              />
              <circle cx="140" cy="60" r="2.2" fill={stroke} />
              <circle cx="140" cy="78" r="2.2" fill={stroke} />
              {/* Left & Right Folded Collar Wings */}
              <path
                d="M100,28 L106,18 Q140,34 174,18 L180,28 L160,54 L140,42 L120,54 Z"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M106,18 Q140,34 174,18" fill="none" stroke={stroke} strokeWidth="1.2" />
            </g>
          ) : (
            <path
              d="M98,28 L104,18 Q140,28 176,18 L182,28 Q140,42 98,28 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          )}
        </g>
      );
    }

    // 6. PENDEK (Default Standard Short Sleeve T-Shirt)
    return (
      <g>
        <path
          d={
            side === 'front'
              ? 'M100,26 Q140,56 180,26 L212,40 L258,86 L228,135 L204,119 L204,284 L76,284 L76,119 L52,135 L22,86 L68,40 Z'
              : 'M100,26 Q140,38 180,26 L212,40 L258,86 L228,135 L204,119 L204,284 L76,284 L76,119 L52,135 L22,86 L68,40 Z'
          }
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M76,119 Q84,78 70,40" fill="none" stroke={stroke} strokeWidth="1.4" />
        <path d="M204,119 Q196,78 210,40" fill="none" stroke={stroke} strokeWidth="1.4" />
        {side === 'front' ? (
          <>
            <path
              d="M98,26 Q140,66 182,26 L176,20 Q140,53 104,20 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M104,20 Q140,39 176,20" fill="none" stroke={stroke} strokeWidth="1.2" />
          </>
        ) : (
          <path
            d="M99,26 Q140,40 181,26 L176,20 Q140,32 104,20 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        )}
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={(e) => {
        if (dragging) updateFromPointer(e.clientX, e.clientY);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => setDragging(false)}
      className={`relative w-full max-w-[245px] mx-auto select-none touch-none ${className}`}
    >
      <svg
        viewBox="0 0 280 300"
        className="w-full h-auto block"
        xmlns="http://www.w3.org/2000/svg"
      >
        {renderGarmentPaths()}
      </svg>

      {/* Positioned PNG Artwork */}
      {designDataUrl && (
        <div
          onPointerDown={(e) => {
            if (!interactive) return;
            e.preventDefault();
            setDragging(true);
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          style={{
            left: `${activePlacement.x}%`,
            top: `${activePlacement.y}%`,
            width: `${activePlacement.scale}%`,
            transform: 'translate(-50%, -50%)',
          }}
          className={`absolute flex items-center justify-center ${
            interactive
              ? 'cursor-grab active:cursor-grabbing border border-dashed border-sky-400/80 bg-sky-500/10 rounded p-0.5 hover:border-sky-300'
              : 'pointer-events-none'
          }`}
        >
          <img
            src={designDataUrl}
            alt={side === 'front' ? 'Desain Depan' : 'Desain Belakang'}
            referrerPolicy="no-referrer"
            draggable={false}
            className="w-full h-auto max-h-full object-contain pointer-events-none"
          />
        </div>
      )}
    </div>
  );
};

export const ShirtPurchaseOrderSheet: React.FC<ShirtPurchaseOrderSheetProps> = ({
  order,
  shop,
  spec,
  displayInvoiceNumber,
}) => {
  const sizeTotals = getShirtSizeTotals(spec.sizeMatrix);
  const orderItemQty = order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const displayQty = sizeTotals.grandTotal > 0 ? sizeTotals.grandTotal : orderItemQty;

  const rowBySize = new Map(spec.sizeMatrix.map((r) => [r.size.toUpperCase(), r]));

  const sablonLines: string[] = [];
  if (
    spec.inkType.trim() &&
    !spec.sablonNotes.toLowerCase().includes(spec.inkType.trim().toLowerCase())
  ) {
    sablonLines.push(`${spec.inkType.trim()} Ink`);
  }
  if (spec.frontDesignSize.trim()) {
    sablonLines.push(`Sablon Depan ${spec.frontDesignSize.trim()}`);
  }
  if (spec.backDesignSize.trim()) {
    sablonLines.push(`Sablon Belakang ${spec.backDesignSize.trim()}`);
  }
  for (const rawLine of (spec.sablonNotes || '').split(/\r?\n/)) {
    const clean = rawLine.replace(/^[\s\-*•]+/, '').trim();
    if (clean) sablonLines.push(clean);
  }

  const sewingLines = (spec.sewingNotes || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
    .filter(Boolean);

  const finishingLines = (spec.finishingNotes || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
    .filter(Boolean);

  const swatches =
    spec.swatchColors && spec.swatchColors.length > 0
      ? spec.swatchColors.slice(0, 20)
      : ['#FFFFFF', '#0284C7'];

  const garmentStyle: GarmentStyle = spec.garmentStyle || 'pendek';
  const hasAnyUploadedMockup = Boolean(spec.frontMockupDataUrl || spec.backMockupDataUrl);
  const useDirectUploadedMockup =
    spec.mockupDisplayMode === 'uploaded_mockup' && hasAnyUploadedMockup;

  const workflowCols = [
    'KONSUMEN',
    'CUSTOMER SERVICE',
    'KAIN',
    'FILM',
    'POTONG',
    'AFDRUK',
    'SABLON',
    'QC SABLON',
    'FINISHING',
    'JAHIT',
    'PACKING',
  ];

  return (
    <div className="space-y-3 text-black bg-white">
      {/* 1. Top Header: PURCHASE ORDER NO. | SHOP NAME */}
      <div className="flex flex-wrap items-end justify-between gap-2 pb-1.5 border-b-2 border-black">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-black uppercase leading-none">
            PURCHASE ORDER
          </h2>
          <div className="text-xs font-bold text-black">
            NO.{' '}
            <span className="text-red-600 font-black tabular-nums">
              -{displayInvoiceNumber}
            </span>
          </div>
        </div>

        <div className="text-lg sm:text-2xl font-serif font-black tracking-tight text-black uppercase leading-none text-right">
          {shop.shopName}
        </div>
      </div>

      {/* 2. Metadata 3-Column Strip */}
      <div className="grid grid-cols-12 gap-3 text-[11px] leading-snug">
        {/* Left Metadata: Customer, Name Order, Order Date & Finish Date */}
        <div className="col-span-12 sm:col-span-5 space-y-1.5">
          <div className="flex items-baseline gap-1.5 pb-1 border-b border-black">
            <span className="w-[78px] shrink-0 font-medium text-slate-800">CUSTOMER</span>
            <span className="font-bold">:</span>
            <span className="font-extrabold text-black uppercase truncate">
              {order.customerName}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 pb-1 border-b border-black">
            <span className="w-[78px] shrink-0 font-medium text-slate-800">NAME ORDER</span>
            <span className="font-bold">:</span>
            <span className="font-extrabold text-black uppercase truncate">
              {spec.orderTitle || order.items[0]?.name || '-'}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pb-1 border-b border-black">
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-slate-800">ORDER DATE</span>
              <span className="font-bold">:</span>
              <span className="font-extrabold text-black tabular-nums">
                {formatDateSlashShort(order.orderDate)}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-slate-800">FINISH DATE</span>
              <span className="font-bold">:</span>
              <span className="font-extrabold text-red-600 tabular-nums">
                {order.deadlineDate ? formatDateSlashShort(order.deadlineDate) : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Metadata: Material, Color, Ink */}
        <div className="col-span-12 sm:col-span-4 space-y-1.5">
          <div className="flex items-baseline gap-1.5 pb-1 border-b border-black">
            <span className="w-[62px] shrink-0 font-medium text-slate-800">MATERIAL</span>
            <span className="font-bold">:</span>
            <span className="font-extrabold text-red-600 uppercase truncate">
              {spec.material || '-'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 pb-1 border-b border-black">
            <span className="w-[62px] shrink-0 font-medium text-slate-800">COLOR</span>
            <span className="font-bold">:</span>
            <span className="font-extrabold text-red-600 uppercase truncate">
              {spec.shirtColor || '-'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 pb-1 border-b border-black">
            <span className="w-[62px] shrink-0 font-medium text-slate-800">INK</span>
            <span className="font-bold">:</span>
            <span className="font-extrabold text-red-600 uppercase truncate">
              {spec.inkType || '-'}
            </span>
          </div>
        </div>

        {/* Right Metadata: Quantity & Pola */}
        <div className="col-span-12 sm:col-span-3 flex flex-col justify-between space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-slate-800">QUANTITY</span>
            <span className="font-bold">:</span>
            <span className="text-xl font-black text-red-600 tabular-nums leading-none">
              {displayQty}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-black">
            <span className="font-medium text-slate-800">POLA :</span>
            {SHIRT_POLA_OPTIONS.map((opt) => {
              const checked = spec.pola === opt;
              return (
                <span key={opt} className="inline-flex items-center gap-0.5 whitespace-nowrap">
                  <span className="w-3 h-3 border border-black inline-flex items-center justify-center bg-white">
                    {checked && <span className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                  </span>
                  <span>{opt}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Main Split: Left Mockup Stage (8 cols) | Right Size Matrix & Keterangan (4 cols) */}
      <div className="grid grid-cols-12 gap-3 items-stretch pt-1">
        {/* Left: Garment Front & Back Mockup */}
        <div className="col-span-12 sm:col-span-8 flex flex-col justify-between py-2 relative min-h-[340px]">
          {useDirectUploadedMockup ? (
            <div className="flex-1 flex flex-col justify-center">
              {spec.frontMockupDataUrl && spec.backMockupDataUrl ? (
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className="text-center space-y-2">
                    <div className="h-[260px] flex items-center justify-center p-1">
                      <img
                        src={spec.frontMockupDataUrl}
                        alt="Mockup Kaos Depan"
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="text-sm font-black tracking-wide uppercase">DEPAN</div>
                    {spec.frontDesignSize && (
                      <div className="text-[10px] font-bold text-red-600">
                        Ukuran Desain: {spec.frontDesignSize}
                      </div>
                    )}
                  </div>
                  <div className="text-center space-y-2">
                    <div className="h-[260px] flex items-center justify-center p-1">
                      <img
                        src={spec.backMockupDataUrl}
                        alt="Mockup Kaos Belakang"
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="text-sm font-black tracking-wide uppercase">BELAKANG</div>
                    {spec.backDesignSize && (
                      <div className="text-[10px] font-bold text-red-600">
                        Ukuran Desain: {spec.backDesignSize}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="h-[280px] flex items-center justify-center p-1">
                    <img
                      src={spec.frontMockupDataUrl || spec.backMockupDataUrl}
                      alt="Mockup Desain Kaos"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-8 text-sm font-black tracking-wide uppercase">
                    <span>{spec.frontMockupDataUrl ? 'DEPAN' : 'BELAKANG'}</span>
                  </div>
                  {(spec.frontDesignSize || spec.backDesignSize) && (
                    <div className="text-[10px] font-bold text-red-600">
                      {[
                        spec.frontDesignSize ? `Depan: ${spec.frontDesignSize}` : '',
                        spec.backDesignSize ? `Belakang: ${spec.backDesignSize}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-2 gap-3 items-center">
              <div className="text-center space-y-1.5">
                <VectorGarmentMockup
                  side="front"
                  garmentStyle={garmentStyle}
                  shirtColorHex={spec.shirtColorHex}
                  sleeveColorHex={spec.sleeveColorHex}
                  designDataUrl={spec.frontMockupDataUrl}
                  placement={spec.frontPlacement}
                />
                <div className="text-sm font-black tracking-wide uppercase text-black">DEPAN</div>
                {spec.frontDesignSize && (
                  <div className="text-[10px] font-bold text-red-600">
                    Desain: {spec.frontDesignSize}
                  </div>
                )}
              </div>
              <div className="text-center space-y-1.5">
                <VectorGarmentMockup
                  side="back"
                  garmentStyle={garmentStyle}
                  shirtColorHex={spec.shirtColorHex}
                  sleeveColorHex={spec.sleeveColorHex}
                  designDataUrl={spec.backMockupDataUrl}
                  placement={spec.backPlacement}
                />
                <div className="text-sm font-black tracking-wide uppercase text-black">
                  BELAKANG
                </div>
                {spec.backDesignSize && (
                  <div className="text-[10px] font-bold text-red-600">
                    Desain: {spec.backDesignSize}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom-left & Bottom-right Multi-Color Sablon Swatch Boxes */}
          <div className="flex items-end justify-between gap-3 px-2 pt-2">
            <div className="flex flex-wrap gap-1 max-w-[115px]">
              {swatches.map((hex, idx) => (
                <div
                  key={`sw-l-${idx}`}
                  className="w-4 h-4 border border-black shrink-0"
                  style={{ backgroundColor: hex }}
                  title={`Warna Sablon ${idx + 1}: ${hex}`}
                />
              ))}
            </div>

            <div className="text-[10px] font-semibold text-slate-700 text-center">
              {[
                spec.shirtColor ? `Kaos: ${spec.shirtColor}` : '',
                `Model: ${garmentStyle.toUpperCase()}`,
                `Warna Sablon: ${swatches.length}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>

            <div className="flex flex-wrap justify-end gap-1 max-w-[115px]">
              {swatches.map((hex, idx) => (
                <div
                  key={`sw-r-${idx}`}
                  className="w-4 h-4 border border-black shrink-0"
                  style={{ backgroundColor: hex }}
                  title={`Warna Sablon ${idx + 1}: ${hex}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Size Matrix + Keterangan Sablon / Jahit / Finishing */}
        <div className="col-span-12 sm:col-span-4 flex flex-col">
          <table className="w-full border-collapse border border-black text-[10px] tabular-nums">
            <thead>
              <tr className="bg-white text-black font-black text-center">
                <th className="border border-black py-1 px-1">SIZE</th>
                <th className="border border-black py-1 px-1 text-[9px]">PENDEK</th>
                <th className="border border-black py-1 px-1 text-[9px]">PANJANG</th>
                <th className="border border-black py-1 px-1 text-[9px]">3/4</th>
                <th className="border border-black py-1 px-1 text-[8px]">OVERSIZE</th>
              </tr>
            </thead>
            <tbody>
              {SHIRT_SIZE_LABELS.map((sz) => {
                const r = rowBySize.get(sz);
                const valOrBlank = (n?: number) => (n && n > 0 ? String(n) : '');
                return (
                  <tr key={sz} className="text-center">
                    <td className="border border-black py-0.5 px-1 font-extrabold text-black">
                      {sz}
                    </td>
                    <td className="border border-black py-0.5 px-1 font-extrabold text-red-600">
                      {valOrBlank(r?.pendek)}
                    </td>
                    <td className="border border-black py-0.5 px-1 font-extrabold text-red-600">
                      {valOrBlank(r?.panjang)}
                    </td>
                    <td className="border border-black py-0.5 px-1 font-extrabold text-red-600">
                      {valOrBlank(r?.tigaPerempat)}
                    </td>
                    <td className="border border-black py-0.5 px-1 font-extrabold text-red-600">
                      {valOrBlank(r?.oversize)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#FFFF00] font-black text-center text-black">
                <td className="border border-black py-1 px-1 text-left">Total</td>
                <td className="border border-black py-1 px-1">
                  {sizeTotals.pendek > 0 ? sizeTotals.pendek : ''}
                </td>
                <td className="border border-black py-1 px-1">
                  {sizeTotals.panjang > 0 ? sizeTotals.panjang : ''}
                </td>
                <td className="border border-black py-1 px-1">
                  {sizeTotals.tigaPerempat > 0 ? sizeTotals.tigaPerempat : ''}
                </td>
                <td className="border border-black py-1 px-1">
                  {sizeTotals.oversize > 0 ? sizeTotals.oversize : ''}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Spec Notes Container */}
          <div className="border-x border-b border-black p-2.5 flex-1 flex flex-col justify-between space-y-3 text-[10px]">
            <div className="space-y-1">
              <div className="font-extrabold text-black underline uppercase">
                : KETERANGAN SABLON :
              </div>
              <div className="space-y-0.5 pl-1 text-red-600 font-bold leading-snug">
                {sablonLines.length > 0 ? (
                  sablonLines.map((line, i) => <div key={i}>- {line}</div>)
                ) : (
                  <div className="text-slate-400 font-normal italic">-</div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-extrabold text-black underline uppercase">
                : KETERANGAN JAHIT
              </div>
              <div className="space-y-0.5 pl-1 text-red-600 font-bold leading-snug min-h-[24px]">
                {sewingLines.map((line, i) => (
                  <div key={i}>- {line}</div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-extrabold text-black underline uppercase">: FINISHING:</div>
              <div className="space-y-0.5 pl-1 text-red-600 font-bold leading-snug min-h-[20px]">
                {finishingLines.map((line, i) => (
                  <div key={i}>- {line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Production Workflow & QC Sign-off Strip */}
      <div className="overflow-x-auto pt-1">
        <table className="w-full border-collapse border border-black text-[8px] sm:text-[9px] text-center">
          <tbody>
            {/* Top thin spacer cells */}
            <tr className="h-3.5">
              {workflowCols.map((col) => (
                <td key={`top-${col}`} className="border border-black" />
              ))}
              <td className="border border-black w-8" />
              <td
                rowSpan={2}
                className="border border-black bg-[#FFFF00] px-1.5 py-1 font-extrabold text-[8px] leading-tight text-black w-[115px]"
              >
                SUDAH DIAMBIL KONSUMEN
                <br />
                UKURAN DAN JUMLAH
                <br />
                SUDAH DIHITUNG
                <br />
                SESUAI PESANAN
              </td>
            </tr>
            {/* Stage Labels */}
            <tr className="font-extrabold text-black">
              {workflowCols.map((col) => (
                <td key={col} className="border border-black py-1 px-0.5 leading-tight">
                  {col}
                </td>
              ))}
              <td className="border border-black" />
            </tr>
            {/* Blank Sign-Off Boxes */}
            <tr className="h-8">
              {workflowCols.map((col) => (
                <td key={`sign-${col}`} className="border border-black" />
              ))}
              <td className="border border-black" />
              <td className="border border-black" />
            </tr>
            {/* Bottom narrow strip */}
            <tr className="h-4">
              {workflowCols.map((col) => (
                <td key={`btm-${col}`} className="border border-black" />
              ))}
              <td className="border border-black" />
              <td className="border border-black font-bold">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
