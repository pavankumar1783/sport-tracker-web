/** Inline stroke icons (24x24 grid, Lucide-style geometry). Add new ones here; no icon font is loaded. */
export interface IconDef {
  paths?: readonly string[];
  circles?: readonly (readonly [cx: number, cy: number, r: number])[];
  rects?: readonly (readonly [x: number, y: number, w: number, h: number, rx: number])[];
}

export const ICONS = {
  dashboard: {
    rects: [
      [3, 3, 7, 9, 1],
      [14, 3, 7, 5, 1],
      [14, 12, 7, 9, 1],
      [3, 16, 7, 5, 1],
    ],
  },
  trophy: {
    paths: [
      'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
      'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
      'M4 22h16',
      'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
      'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
      'M18 2H6v7a6 6 0 0 0 12 0V2Z',
    ],
  },
  users: {
    paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ],
    circles: [[9, 7, 4]],
  },
  user: { paths: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'], circles: [[12, 7, 4]] },
  calendar: { paths: ['M16 2v4', 'M8 2v4', 'M3 10h18'], rects: [[3, 4, 18, 18, 2]] },
  chart: { paths: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'] },
  plus: { paths: ['M5 12h14', 'M12 5v14'] },
  minus: { paths: ['M5 12h14'] },
  check: { paths: ['M20 6 9 17l-5-5'] },
  x: { paths: ['M18 6 6 18', 'M6 6l12 12'] },
  'chevron-right': { paths: ['m9 18 6-6-6-6'] },
  'chevron-left': { paths: ['m15 18-6-6 6-6'] },
  'chevron-down': { paths: ['m6 9 6 6 6-6'] },
  'arrow-left': { paths: ['m12 19-7-7 7-7', 'M19 12H5'] },
  menu: { paths: ['M4 12h16', 'M4 6h16', 'M4 18h16'] },
  'log-out': { paths: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'] },
  'log-in': { paths: ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'm10 17 5-5-5-5', 'M15 12H3'] },
  play: { paths: ['m6 3 14 9-14 9V3Z'] },
  flag: {
    paths: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  },
  clock: { paths: ['M12 6v6l4 2'], circles: [[12, 12, 10]] },
  alert: {
    paths: [
      'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
      'M12 9v4',
      'M12 17h.01',
    ],
  },
  info: { paths: ['M12 16v-4', 'M12 8h.01'], circles: [[12, 12, 10]] },
  search: { paths: ['m21 21-4.3-4.3'], circles: [[11, 11, 8]] },
  refresh: {
    paths: [
      'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
      'M21 3v5h-5',
      'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
      'M8 16H3v5',
    ],
  },
  shield: {
    paths: [
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    ],
  },
  medal: {
    paths: [
      'M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15',
      'M11 12 5.12 2.2',
      'm13 12 5.88-9.8',
      'M8 7h8',
    ],
    circles: [[12, 17, 5]],
  },
  edit: { paths: ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'] },
  trash: {
    paths: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  },
  settings: {
    paths: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  },
  list: { paths: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'] },
  star: {
    paths: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
  },
  lock: { paths: ['M7 11V7a5 5 0 0 1 10 0v4'], rects: [[3, 11, 18, 11, 2]] },
  undo: { paths: ['M3 7v6h6', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'] },
  zap: { paths: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'] },
  eye: { paths: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z'], circles: [[12, 12, 3]] },
  versus: {
    paths: [
      'M14.5 17.5 3 6V3h3l11.5 11.5',
      'm13 19 6-6',
      'M16 16l4 4',
      'M19 21l2-2',
      'M14.5 6.5 18 3h3v3l-3.5 3.5',
      'm5 14 4 4',
      'M7 17l-3 3',
      'M3 19l2 2',
    ],
  },
  racket: { paths: ['m15 15 6 6'], circles: [[10, 10, 7], [19, 5, 1.5]] },
  more: { circles: [[5, 12, 1], [12, 12, 1], [19, 12, 1]] },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
