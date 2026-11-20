import React from 'react';
import { Printer } from 'lucide-react';

interface ShopLogoProps {
  logoDataUrl?: string;
  shopName: string;
  accentColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  lightSurface?: boolean;
}

export const ShopLogo: React.FC<ShopLogoProps> = ({
  logoDataUrl,
  shopName,
  accentColor = '#0EA5E9',
  size = 'md',
  lightSurface = false,
}) => {
  const [imgBroken, setImgBroken] = React.useState(false);

  React.useEffect(() => {
    setImgBroken(false);
  }, [logoDataUrl]);

  const dim =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'xl'
        ? 'w-20 h-20 rounded-xl'
        : size === 'lg'
          ? 'w-14 h-14 rounded-xl'
          : 'w-10 h-10 rounded-lg';

  const iconDim =
    size === 'sm' ? 'w-4 h-4' : size === 'xl' ? 'w-9 h-9' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';

  if (logoDataUrl && !imgBroken) {
    return (
      <div
        className={`${dim} shrink-0 overflow-hidden flex items-center justify-center border ${
          lightSurface ? 'bg-white border-slate-200' : 'bg-[#0B0F17] border-[#232C3D]'
        }`}
      >
        <img
          src={logoDataUrl}
          alt={`Logo ${shopName}`}
          referrerPolicy="no-referrer"
          onError={() => setImgBroken(true)}
          className="w-full h-full object-contain p-0.5"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dim} shrink-0 flex items-center justify-center font-bold text-slate-950`}
      style={{ backgroundColor: accentColor }}
      aria-label={`Logo ${shopName}`}
    >
      <Printer className={iconDim} />
    </div>
  );
};
