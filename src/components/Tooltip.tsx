import React from 'react';

interface TooltipProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Tooltip: React.FC<TooltipProps> = ({ show, children, className = '', style = {} }) => {
  if (!show) return null;
  return (
    <div
      className={`absolute left-1/2 top-full z-20 mt-2 max-w-xs -translate-x-1/2 bg-white text-black rounded shadow-lg px-3 py-1 text-xs border border-gray-200 animate-fade-in whitespace-nowrap overflow-hidden text-ellipsis ${className}`}
      style={{ ...style }}
    >
      {children}
    </div>
  );
};

export default Tooltip;

// Animacao fade-in global (pode ser importada no App ou index.html)
// .animate-fade-in{animation:fadeIn .15s ease-in}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} 