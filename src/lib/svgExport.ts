// Download an in-DOM SVG element as a standalone .svg file. Adds an XML
// preamble and namespace declaration so the file opens correctly in vector
// editors and renders in browsers without the host page's CSS.

import { provenanceCsvHeader } from './provenance.js';

export function downloadSvgElement(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Inline the computed styles for fonts and stroke widths so the file
  // renders the same when opened outside the app.
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  if (!clone.getAttribute('viewBox')) {
    const w = svg.getAttribute('width');
    const h = svg.getAttribute('height');
    if (w && h) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  const serializer = new XMLSerializer();
  const body = serializer.serializeToString(clone);
  // Provenance as an XML comment block so opening the file in a text editor
  // (or `grep commit *.svg`) reveals the exact code that produced the plot.
  const provComment = '<!--\n' + provenanceCsvHeader().replace(/^# /gm, '  ') + '\n-->';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${provComment}\n${body}`;
  const blob = new Blob([xml], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
