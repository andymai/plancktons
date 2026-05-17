import { useRef, type ReactNode } from 'react';
import { downloadSvgElement } from '../lib/svgExport.js';

/**
 * SVG container with a small "download as .svg" overlay button in the top-
 * right corner. Used for every Research-panel plot so each figure can be
 * exported individually for papers / notebooks.
 */
export function SvgPlot({
  width,
  height,
  filename,
  children,
}: {
  width: number;
  height: number;
  filename: string;
  children: ReactNode;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  return (
    <div className="svg-plot-wrap">
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        className="plot"
      >
        {children}
      </svg>
      <button
        className="svg-plot-download"
        onClick={() => {
          if (ref.current) downloadSvgElement(ref.current, filename);
        }}
        title="Download this plot as a standalone SVG file"
      >
        ⬇ SVG
      </button>
    </div>
  );
}
