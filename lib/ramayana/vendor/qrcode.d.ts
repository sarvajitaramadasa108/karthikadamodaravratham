// qrcode-generator 1.4.4, vendored under MIT. See LICENSE.qrcode-generator.
declare function qrcode(typeNumber: number, level: 'L' | 'M' | 'Q' | 'H'): {
  addData(data: string): void;
  make(): void;
  createSvgTag(options?: { cellSize?: number; margin?: number; scalable?: boolean }): string;
};
export = qrcode;
