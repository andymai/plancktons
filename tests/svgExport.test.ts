import { describe, it, expect } from 'vitest';
import { downloadSvgElement } from '../src/lib/svgExport.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(attrs: Record<string, string> = {}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '10');
  rect.setAttribute('height', '10');
  svg.appendChild(rect);
  return svg;
}

interface CapturedDownload {
  blob: Blob;
  filename: string;
  url: string;
}

function captureDownload(action: () => void): CapturedDownload {
  let captured: CapturedDownload | null = null;
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b: Blob): string => {
    const url = `blob:test:${Math.random()}`;
    captured = { blob: b, filename: '', url };
    return url;
  };
  URL.revokeObjectURL = (): void => {};
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement): void {
    if (captured) captured.filename = this.download;
  };
  try {
    action();
  } finally {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  if (!captured) throw new Error('no download captured');
  return captured;
}

async function blobText(b: Blob): Promise<string> {
  // happy-dom's Blob supports .text()
  return b.text();
}

describe('downloadSvgElement', () => {
  it('appends .svg extension when missing', () => {
    const cap = captureDownload(() =>
      downloadSvgElement(makeSvg({ width: '100', height: '50' }), 'plot')
    );
    expect(cap.filename).toBe('plot.svg');
  });

  it('preserves existing .svg extension', () => {
    const cap = captureDownload(() =>
      downloadSvgElement(makeSvg({ width: '100', height: '50' }), 'plot.svg')
    );
    expect(cap.filename).toBe('plot.svg');
  });

  it('produces image/svg+xml blob with XML preamble and provenance comment', async () => {
    const cap = captureDownload(() =>
      downloadSvgElement(makeSvg({ width: '100', height: '50' }), 'plot.svg')
    );
    expect(cap.blob.type).toBe('image/svg+xml');
    const text = await blobText(cap.blob);
    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(text).toContain('<!--');
    expect(text).toContain('-->');
    expect(text).toContain('<svg');
    expect(text).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('adds viewBox from width/height when missing', async () => {
    const cap = captureDownload(() =>
      downloadSvgElement(makeSvg({ width: '200', height: '120' }), 'plot.svg')
    );
    const text = await blobText(cap.blob);
    expect(text).toContain('viewBox="0 0 200 120"');
  });

  it('preserves an existing viewBox attribute', async () => {
    const svg = makeSvg({ width: '200', height: '120', viewBox: '5 6 7 8' });
    const cap = captureDownload(() => downloadSvgElement(svg, 'plot.svg'));
    const text = await blobText(cap.blob);
    expect(text).toContain('viewBox="5 6 7 8"');
    expect(text).not.toContain('viewBox="0 0 200 120"');
  });

  it('skips viewBox when width/height are missing', async () => {
    const cap = captureDownload(() => downloadSvgElement(makeSvg(), 'plot.svg'));
    const text = await blobText(cap.blob);
    // The newly-added viewBox attribute should not appear.
    expect(text.includes('viewBox=')).toBe(false);
  });

  it('clones source so original svg is unmodified', () => {
    const svg = makeSvg({ width: '100', height: '50' });
    expect(svg.getAttribute('viewBox')).toBeNull();
    captureDownload(() => downloadSvgElement(svg, 'plot.svg'));
    expect(svg.getAttribute('viewBox')).toBeNull();
  });
});
