import type { SVGProps } from 'react';

const ICON_PROPS: SVGProps<SVGSVGElement> = {
  width: 12,
  height: 12,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M8 1.5v6M5 7.5h6l-1.5 3h-3l-1.5-3zM8 10.5v4" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M3 13.5h10" />
    </svg>
  );
}
