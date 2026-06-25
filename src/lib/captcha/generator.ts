import sharp from 'sharp';

export type ShapeType = 'circle' | 'triangle' | 'square' | 'hexagon' | 'star' | 'arrow' | 'cross';

export interface ShapeConfig {
  kind: 'shape';
  type: ShapeType;
  color: string; // Will be strictly #000000 or grayscale in monochrome light theme
  count: number;
  rotation: number; // in degrees
}

export interface TextConfig {
  kind: 'text';
  value: string;
}

export interface DominoConfig {
  kind: 'domino';
  top: number;
  bottom: number;
}

export interface TileConfig {
  kind: 'tile';
  cells: TileCells;
  rotation: number;
}

export interface ClockConfig {
  kind: 'clock';
  angle: number;
}

export interface BarsConfig {
  kind: 'bars';
  heights: [number, number, number];
}

export type CaptchaCell = ShapeConfig | TextConfig | DominoConfig | TileConfig | ClockConfig | BarsConfig;
type TileCells = [boolean, boolean, boolean, boolean];

export interface CaptchaPuzzle {
  grid: (CaptchaCell | null)[];
  choices: CaptchaCell[];
  correctChoiceIndex: number;
}

/**
 * Helper to shuffle arrays
 */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pick<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

function shapeConfig(type: ShapeType, count: number, rotation = 0): ShapeConfig {
  return {
    kind: 'shape',
    type,
    color: '#000000',
    count,
    rotation: normalizeRotation(rotation),
  };
}

function textConfig(value: number | string): TextConfig {
  return {
    kind: 'text',
    value: String(value),
  };
}

function dominoConfig(top: number, bottom: number): DominoConfig {
  return {
    kind: 'domino',
    top: ((top % 7) + 7) % 7,
    bottom: ((bottom % 7) + 7) % 7,
  };
}

function tileConfig(cells: TileCells, rotation = 0): TileConfig {
  return {
    kind: 'tile',
    cells,
    rotation: normalizeRotation(rotation),
  };
}

function clockConfig(angle: number): ClockConfig {
  return {
    kind: 'clock',
    angle: normalizeRotation(angle),
  };
}

function barsConfig(heights: [number, number, number]): BarsConfig {
  return {
    kind: 'bars',
    heights: heights.map((height) => Math.max(1, Math.min(4, height))) as [number, number, number],
  };
}

function visualKeyFor(choice: CaptchaCell): string {
  switch (choice.kind) {
    case 'text':
      return `text:${choice.value}`;
    case 'domino':
      return `domino:${choice.top}:${choice.bottom}`;
    case 'tile': {
      const turns = Math.round(normalizeRotation(choice.rotation) / 90) % 4;
      let cells = choice.cells;
      for (let i = 0; i < turns; i++) {
        cells = rotateTile(cells);
      }
      return `tile:${cells.map((cell) => (cell ? '1' : '0')).join('')}`;
    }
    case 'clock':
      return `clock:${choice.angle}`;
    case 'bars':
      return `bars:${choice.heights.join(':')}`;
    case 'shape': {
      const symmetryDegrees: Record<ShapeType, number> = {
        circle: 360,
        triangle: 120,
        square: 90,
        hexagon: 60,
        star: 72,
        arrow: 360,
        cross: 90,
      };
      const symmetry = symmetryDegrees[choice.type];
      const visualRotation = choice.type === 'circle' ? 0 : normalizeRotation(choice.rotation) % symmetry;
      return `shape:${choice.type}:${choice.count}:${visualRotation}`;
    }
  }
}

function fallbackDistractorsFor(correctChoice: CaptchaCell): CaptchaCell[] {
  switch (correctChoice.kind) {
    case 'text': {
      const numericValue = Number(correctChoice.value);
      if (Number.isFinite(numericValue)) {
        return [-9, -7, -5, -3, -2, -1, 1, 2, 3, 5, 7, 9]
          .map((offset) => textConfig(numericValue + offset));
      }

      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      return alphabet
        .split('')
        .filter((letter) => letter !== correctChoice.value)
        .map((letter) => textConfig(letter));
    }
    case 'domino': {
      const choices: DominoConfig[] = [];
      for (let top = 0; top <= 6; top++) {
        for (let bottom = 0; bottom <= 6; bottom++) {
          choices.push(dominoConfig(top, bottom));
        }
      }
      return choices;
    }
    case 'tile': {
      const choices: TileConfig[] = [];
      for (let mask = 1; mask < 16; mask++) {
        const cells: TileCells = [
          Boolean(mask & 1),
          Boolean(mask & 2),
          Boolean(mask & 4),
          Boolean(mask & 8),
        ];
        choices.push(tileConfig(cells, 0));
      }
      return choices;
    }
    case 'clock':
      return Array.from({ length: 12 }, (_, index) => clockConfig(index * 30));
    case 'bars': {
      const choices: BarsConfig[] = [];
      for (let a = 1; a <= 4; a++) {
        for (let b = 1; b <= 4; b++) {
          for (let c = 1; c <= 4; c++) {
            choices.push(barsConfig([a, b, c]));
          }
        }
      }
      return choices;
    }
    case 'shape': {
      const shapeTypes: ShapeType[] = ['circle', 'triangle', 'square', 'hexagon', 'star', 'arrow', 'cross'];
      const choices: ShapeConfig[] = [];
      for (const type of shapeTypes) {
        for (const count of [1, 2, 3]) {
          for (const rotation of [0, 45, 90, 135, 180, 225, 270, 315]) {
            choices.push(shapeConfig(type, count, rotation));
          }
        }
      }
      return choices;
    }
  }
}

function makeCaptchaPuzzle(
  grid: (CaptchaCell | null)[],
  correctChoice: CaptchaCell,
  distractors: CaptchaCell[]
): CaptchaPuzzle {
  const candidateDistractors = [...distractors, ...fallbackDistractorsFor(correctChoice)];
  const uniqueDistractors = candidateDistractors.filter((choice, index, choices) => (
    visualKeyFor(choice) !== visualKeyFor(correctChoice) &&
    choices.findIndex((candidate) => visualKeyFor(candidate) === visualKeyFor(choice)) === index
  ));

  if (uniqueDistractors.length < 3) {
    throw new Error('CAPTCHA puzzle needs at least three visually unique distractors.');
  }

  const choicesWithAnswer = shuffle([correctChoice, ...uniqueDistractors.slice(0, 3)]);
  const correctChoiceIndex = choicesWithAnswer.findIndex((choice) => visualKeyFor(choice) === visualKeyFor(correctChoice));

  return {
    grid,
    choices: choicesWithAnswer,
    correctChoiceIndex,
  };
}

/**
 * Render a single shape with monochrome light theme styling.
 */
function renderShape(config: ShapeConfig, cx: number, cy: number, r: number): string {
  const fill = config.color; // #000000
  const stroke = '#ffffff';  // Inverted: white outline separates shapes nicely
  const strokeWidth = 2.5;
  const rotation = config.rotation;
  
  // Keep rotations exact. Later levels rely on comparing angle progressions precisely.
  const finalRotation = rotation;

  switch (config.type) {
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="rotate(${finalRotation}, ${cx}, ${cy})" />`;
      
    case 'square':
      return `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="${r * 0.15}" ry="${r * 0.15}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="rotate(${finalRotation}, ${cx}, ${cy})" />`;
      
    case 'triangle': {
      const yOffset = r * 0.1;
      const p1 = `${cx},${cy - r + yOffset}`;
      const p2 = `${cx - r * 0.86},${cy + r * 0.5 + yOffset}`;
      const p3 = `${cx + r * 0.86},${cy + r * 0.5 + yOffset}`;
      return `<polygon points="${p1} ${p2} ${p3}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="rotate(${finalRotation}, ${cx}, ${cy})" />`;
    }
      
    case 'hexagon': {
      let points = '';
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        points += `${x},${y} `;
      }
      return `<polygon points="${points.trim()}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="rotate(${finalRotation}, ${cx}, ${cy})" />`;
    }
      
    case 'star': {
      let points = '';
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const currR = i % 2 === 0 ? r : r * 0.45;
        const x = cx + currR * Math.cos(angle);
        const y = cy + currR * Math.sin(angle);
        points += `${x},${y} `;
      }
      return `<polygon points="${points.trim()}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="rotate(${finalRotation}, ${cx}, ${cy})" />`;
    }
      
    case 'arrow': {
      const w = r * 0.25;
      const p1 = `${cx},${cy - r}`; // tip
      const p2 = `${cx - r * 0.55},${cy - r * 0.1}`; // left tip
      const p3 = `${cx - w},${cy - r * 0.1}`; // left shaft top
      const p4 = `${cx - w},${cy + r}`; // left shaft bottom
      const p5 = `${cx + w},${cy + r}`; // right shaft bottom
      const p6 = `${cx + w},${cy - r * 0.1}`; // right shaft top
      const p7 = `${cx + r * 0.55},${cy - r * 0.1}`; // right tip
      const points = `${p1} ${p2} ${p3} ${p4} ${p5} ${p6} ${p7}`;
      return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="rotate(${finalRotation}, ${cx}, ${cy})" />`;
    }
      
    case 'cross': {
      const w = r * 0.3;
      const p1 = `${cx - w},${cy - r}`;
      const p2 = `${cx + w},${cy - r}`;
      const p3 = `${cx + w},${cy - w}`;
      const p4 = `${cx + r},${cy - w}`;
      const p5 = `${cx + r},${cy + w}`;
      const p6 = `${cx + w},${cy + w}`;
      const p7 = `${cx + w},${cy + r}`;
      const p8 = `${cx - w},${cy + r}`;
      const p9 = `${cx - w},${cy + w}`;
      const p10 = `${cx - r},${cy + w}`;
      const p11 = `${cx - r},${cy - w}`;
      const p12 = `${cx - w},${cy - w}`;
      const points = `${p1} ${p2} ${p3} ${p4} ${p5} ${p6} ${p7} ${p8} ${p9} ${p10} ${p11} ${p12}`;
      return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="rotate(${finalRotation}, ${cx}, ${cy})" />`;
    }
  }
}

/**
 * Render contents inside cell (coordinates, counts).
 */
function renderTextCell(config: TextConfig, startX: number, startY: number, cellSize: number): string {
  const centerX = startX + cellSize / 2;
  const centerY = startY + cellSize / 2;
  const length = config.value.length;
  const fontSize = length >= 4 ? 34 : length >= 3 ? 42 : 52;

  return `
    <text x="${centerX}" y="${centerY + fontSize * 0.34}" font-size="${fontSize}" font-family="Courier New, monospace" font-weight="700" fill="#000000" text-anchor="middle">${config.value}</text>
  `;
}

function renderDominoPips(value: number, centerX: number, centerY: number, size: number): string {
  if (value === 0) return '';

  const d = size * 0.18;
  const positions: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-d, -d], [d, d]],
    3: [[-d, -d], [0, 0], [d, d]],
    4: [[-d, -d], [d, -d], [-d, d], [d, d]],
    5: [[-d, -d], [d, -d], [0, 0], [-d, d], [d, d]],
    6: [[-d, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [d, d]],
  };

  return positions[value]
    .map(([dx, dy]) => `<circle cx="${centerX + dx}" cy="${centerY + dy}" r="${size * 0.055}" fill="#000000" />`)
    .join('');
}

function renderDominoCell(config: DominoConfig, startX: number, startY: number, cellSize: number): string {
  const padding = cellSize * 0.19;
  const x = startX + padding;
  const y = startY + padding;
  const w = cellSize - padding * 2;
  const h = cellSize - padding * 2;
  const centerX = startX + cellSize / 2;
  const topY = y + h * 0.25;
  const bottomY = y + h * 0.75;

  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#000000" stroke-width="2.5" />
    <line x1="${x + 8}" y1="${y + h / 2}" x2="${x + w - 8}" y2="${y + h / 2}" stroke="#000000" stroke-width="2" />
    ${renderDominoPips(config.top, centerX, topY, w)}
    ${renderDominoPips(config.bottom, centerX, bottomY, w)}
  `;
}

function renderTileCell(config: TileConfig, startX: number, startY: number, cellSize: number): string {
  const tileSize = cellSize * 0.58;
  const x = startX + (cellSize - tileSize) / 2;
  const y = startY + (cellSize - tileSize) / 2;
  const unit = tileSize / 2;
  const gap = 5;

  const squares = config.cells.map((isFilled, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return `<rect x="${x + col * unit + gap / 2}" y="${y + row * unit + gap / 2}" width="${unit - gap}" height="${unit - gap}" fill="${isFilled ? '#000000' : '#ffffff'}" stroke="#000000" stroke-width="2" />`;
  }).join('');

  return `<g transform="rotate(${config.rotation}, ${startX + cellSize / 2}, ${startY + cellSize / 2})">${squares}</g>`;
}

function renderClockCell(config: ClockConfig, startX: number, startY: number, cellSize: number): string {
  const centerX = startX + cellSize / 2;
  const centerY = startY + cellSize / 2;
  const radius = cellSize * 0.28;
  const handLength = radius * 0.78;
  const radians = (config.angle - 90) * Math.PI / 180;
  const handX = centerX + Math.cos(radians) * handLength;
  const handY = centerY + Math.sin(radians) * handLength;
  const ticks = Array.from({ length: 12 }, (_, index) => {
    const tickAngle = (index * 30 - 90) * Math.PI / 180;
    const x = centerX + Math.cos(tickAngle) * radius * 0.82;
    const y = centerY + Math.sin(tickAngle) * radius * 0.82;
    return `<circle cx="${x}" cy="${y}" r="1.8" fill="#000000" />`;
  }).join('');

  return `
    <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="#ffffff" stroke="#000000" stroke-width="3" />
    ${ticks}
    <line x1="${centerX}" y1="${centerY}" x2="${handX}" y2="${handY}" stroke="#000000" stroke-width="5" stroke-linecap="round" />
    <circle cx="${centerX}" cy="${centerY}" r="4" fill="#000000" />
  `;
}

function renderBarsCell(config: BarsConfig, startX: number, startY: number, cellSize: number): string {
  const baseY = startY + cellSize * 0.72;
  const maxHeight = cellSize * 0.46;
  const barWidth = cellSize * 0.13;
  const gap = cellSize * 0.08;
  const totalWidth = barWidth * 3 + gap * 2;
  const firstX = startX + (cellSize - totalWidth) / 2;
  const bars = config.heights.map((height, index) => {
    const h = maxHeight * (height / 4);
    const x = firstX + index * (barWidth + gap);
    return `<rect x="${x}" y="${baseY - h}" width="${barWidth}" height="${h}" fill="#000000" stroke="#000000" stroke-width="2" />`;
  }).join('');

  return `
    <line x1="${firstX - 6}" y1="${baseY}" x2="${firstX + totalWidth + 6}" y2="${baseY}" stroke="#000000" stroke-width="2" />
    ${bars}
  `;
}

function renderShapeCell(config: ShapeConfig, startX: number, startY: number, cellSize: number, level = 1): string {
  let cx = startX + cellSize / 2;
  let cy = startY + cellSize / 2;
  const count = config.count;
  const isLevel5 = level === 5;
  
  // For Level 5, displace coordinates slightly to increase layout chaos
  if (isLevel5) {
    cx += (Math.random() * 12 - 6);
    cy += (Math.random() * 12 - 6);
  }
  
  // Scale shape size
  const baseRadius = cellSize * 0.28;
  const r = count === 1 ? baseRadius : count === 2 ? baseRadius * 0.78 : baseRadius * 0.63;
  
  let result = '';
  
  if (count === 1) {
    result += renderShape(config, cx, cy, r);
  } else if (count === 2) {
    const offset = cellSize * 0.18;
    result += renderShape(config, cx - offset, cy, r);
    result += renderShape(config, cx + offset, cy, r);
  } else if (count === 3) {
    const offsetHorizontal = cellSize * 0.18;
    const offsetVertical = cellSize * 0.13;
    result += renderShape(config, cx, cy - offsetVertical, r);
    result += renderShape(config, cx - offsetHorizontal, cy + offsetVertical, r);
    result += renderShape(config, cx + offsetHorizontal, cy + offsetVertical, r);
  }
  
  return result;
}

function renderCellContents(config: CaptchaCell, startX: number, startY: number, cellSize: number, level = 1): string {
  switch (config.kind) {
    case 'text':
      return renderTextCell(config, startX, startY, cellSize);
    case 'domino':
      return renderDominoCell(config, startX, startY, cellSize);
    case 'tile':
      return renderTileCell(config, startX, startY, cellSize);
    case 'clock':
      return renderClockCell(config, startX, startY, cellSize);
    case 'bars':
      return renderBarsCell(config, startX, startY, cellSize);
    case 'shape':
      return renderShapeCell(config, startX, startY, cellSize, level);
  }
}

/**
 * Generate visual noise depending on the level.
 */
function generateNoise(width: number, height: number, level: number): string {
  let noise = '';
  
  // 1. Subtle grid paper pattern for levels >= 2
  if (level >= 2) {
    noise += `<rect width="${width}" height="${height}" fill="url(#bwDotGrid)" />`;
  }
  
  // Choose noise parameters based on level (1 to 10 scale)
  let lineCount = 0;
  let dotCount = 0;
  let lineOpacity = 0.06;
  let strokeWidthRange = [1, 2];
  
  if (level === 2) {
    lineCount = 2;
    dotCount = 5;
    lineOpacity = 0.05;
  } else if (level === 3) {
    lineCount = 4;
    dotCount = 10;
    lineOpacity = 0.07;
  } else if (level === 4) {
    lineCount = 6;
    dotCount = 15;
    lineOpacity = 0.09;
  } else if (level === 5) {
    lineCount = 9;
    dotCount = 22;
    lineOpacity = 0.12;
    strokeWidthRange = [1, 2.5];
  } else if (level === 6) {
    lineCount = 12;
    dotCount = 30;
    lineOpacity = 0.15;
    strokeWidthRange = [1, 3];
  } else if (level === 7) {
    lineCount = 16;
    dotCount = 40;
    lineOpacity = 0.18;
    strokeWidthRange = [1, 3.5];
  } else if (level === 8) {
    lineCount = 20;
    dotCount = 50;
    lineOpacity = 0.20;
    strokeWidthRange = [1, 4];
  } else if (level === 9) {
    lineCount = 25;
    dotCount = 65;
    lineOpacity = 0.22;
    strokeWidthRange = [1, 4.5];
  } else if (level >= 10) {
    // LEVEL 10: dense masking for the final reasoning challenge
    lineCount = 36;
    dotCount = 95;
    lineOpacity = 0.25;
    strokeWidthRange = [1.5, 5];
  }
  
  // 2. Render lines (both white eraser lines and black blocking lines)
  for (let i = 0; i < lineCount; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    
    // Inverted theme: black lines block/blend, white lines act as eraser cuts in the shapes
    const strokeColor = i % 2 === 0 ? '#000000' : '#ffffff';
    const finalOpacity = strokeColor === '#ffffff' ? lineOpacity * 1.5 : lineOpacity;
    const strokeWidth = strokeWidthRange[0] + Math.random() * (strokeWidthRange[1] - strokeWidthRange[0]);
    
    noise += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-opacity="${finalOpacity}" stroke-width="${strokeWidth}" />`;
  }
  
  // 3. Render scatter dots
  for (let i = 0; i < dotCount; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const r = 1 + Math.random() * (level >= 10 ? 4 : 2);
    const strokeColor = i % 2 === 0 ? '#000000' : '#ffffff';
    const finalOpacity = strokeColor === '#ffffff' ? 0.3 : 0.2;
    
    noise += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${strokeColor}" fill-opacity="${finalOpacity}" />`;
  }
  
  return noise;
}

function generateNumberSequencePuzzle(level: number): CaptchaPuzzle {
  const grid: (CaptchaCell | null)[] = new Array(9).fill(null);
  const base = pick([2, 3, 4, 5, 7, 9, 11]);
  const rowStep = pick(level >= 6 ? [4, 5, 6, 7, 8] : [1, 2, 3, 4]);
  const colStep = pick(level >= 6 ? [5, 7, 9, 11] : [2, 3, 4, 5]);
  const interaction = level >= 7 ? pick([2, 3, 4, 5]) : 0;
  const squareStep = level >= 10 ? pick([2, 3, 5]) : 0;
  const valueAt = (row: number, col: number) => (
    base +
    row * rowStep +
    col * colStep +
    row * col * interaction +
    (row * row + col * col) * squareStep
  );

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (idx !== 8) grid[idx] = textConfig(valueAt(row, col));
    }
  }

  const correctValue = valueAt(2, 2);
  return makeCaptchaPuzzle(
    grid,
    textConfig(correctValue),
    [
      textConfig(correctValue + colStep),
      textConfig(correctValue - rowStep),
      textConfig(correctValue + Math.max(1, interaction || rowStep + colStep)),
      textConfig(correctValue + pick([2, 3, 5, 7])),
    ]
  );
}

function generateLetterSeriesPuzzle(level: number): CaptchaPuzzle {
  const grid: (CaptchaCell | null)[] = new Array(9).fill(null);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const base = Math.floor(Math.random() * 10);
  const rowStep = pick(level >= 6 ? [2, 3, 5] : [1, 2, 3]);
  const colStep = pick(level >= 6 ? [3, 4, 6] : [1, 2, 4]);
  const interaction = level >= 8 ? pick([1, 2, 3]) : 0;
  const indexAt = (row: number, col: number) => (
    base + row * rowStep + col * colStep + row * col * interaction
  ) % alphabet.length;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (idx !== 8) grid[idx] = textConfig(alphabet[indexAt(row, col)]);
    }
  }

  const correctIndex = indexAt(2, 2);
  return makeCaptchaPuzzle(
    grid,
    textConfig(alphabet[correctIndex]),
    [
      textConfig(alphabet[(correctIndex + rowStep) % alphabet.length]),
      textConfig(alphabet[(correctIndex + colStep) % alphabet.length]),
      textConfig(alphabet[(correctIndex + 1 + interaction) % alphabet.length]),
      textConfig(alphabet[(correctIndex + 13) % alphabet.length]),
    ]
  );
}

function generateDominoPuzzle(level: number): CaptchaPuzzle {
  const grid: (CaptchaCell | null)[] = new Array(9).fill(null);
  const topBase = Math.floor(Math.random() * 7);
  const bottomBase = Math.floor(Math.random() * 7);
  const topRow = pick([1, 2, 3]);
  const topCol = pick([1, 2, 4]);
  const bottomRow = pick(level >= 6 ? [2, 3, 4] : [1, 2, 3]);
  const bottomCol = pick(level >= 6 ? [3, 4, 5] : [1, 3, 4]);
  const pairAt = (row: number, col: number) => dominoConfig(
    topBase + row * topRow + col * topCol,
    bottomBase + row * bottomRow + col * bottomCol + (level >= 8 ? row * col : 0)
  );

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (idx !== 8) grid[idx] = pairAt(row, col);
    }
  }

  const correctChoice = pairAt(2, 2);
  return makeCaptchaPuzzle(
    grid,
    correctChoice,
    [
      dominoConfig(correctChoice.top + 1, correctChoice.bottom),
      dominoConfig(correctChoice.top, correctChoice.bottom + 1),
      dominoConfig(correctChoice.bottom, correctChoice.top),
      dominoConfig(correctChoice.top + 2, correctChoice.bottom + 2),
    ]
  );
}

function rotateTile(cells: TileCells): TileCells {
  return [cells[2], cells[0], cells[3], cells[1]];
}

function xorTile(
  first: TileCells,
  second: TileCells
): TileCells {
  return first.map((cell, index) => cell !== second[index]) as TileCells;
}

function generateTileLogicPuzzle(level: number): CaptchaPuzzle {
  const grid: (CaptchaCell | null)[] = new Array(9).fill(null);
  const rowSeeds = shuffle<TileCells>([
    [true, false, false, true],
    [false, true, true, false],
    [true, true, false, false],
    [false, false, true, true],
    [true, false, true, false],
  ]).slice(0, 3);
  const colSeeds = shuffle<TileCells>([
    [true, false, false, false],
    [false, true, false, true],
    [false, false, true, false],
    [true, true, false, true],
    [false, true, true, true],
  ]).slice(0, 3);
  const rotationStep = level >= 8 ? pick([90, 180, 270]) : pick([0, 90]);
  const cellsAt = (row: number, col: number) => {
    const mixed = xorTile(rowSeeds[row], colSeeds[col]);
    return level >= 7 && (row + col) % 2 === 1 ? rotateTile(mixed) : mixed;
  };

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (idx !== 8) grid[idx] = tileConfig(cellsAt(row, col), (row + col) * rotationStep);
    }
  }

  const correctChoice = tileConfig(cellsAt(2, 2), 4 * rotationStep);
  return makeCaptchaPuzzle(
    grid,
    correctChoice,
    [
      tileConfig(rotateTile(correctChoice.cells), correctChoice.rotation),
      tileConfig(correctChoice.cells, correctChoice.rotation + 90),
      tileConfig(xorTile(correctChoice.cells, [true, false, false, false]), correctChoice.rotation),
      tileConfig(xorTile(correctChoice.cells, [false, false, false, true]), correctChoice.rotation + 180),
    ]
  );
}

function generateClockPuzzle(level: number): CaptchaPuzzle {
  const grid: (CaptchaCell | null)[] = new Array(9).fill(null);
  const baseAngle = pick([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  const rowStep = pick(level >= 7 ? [30, 60, 90, 120] : [30, 60, 90]);
  const colStep = pick(level >= 7 ? [60, 90, 120, 150] : [30, 60, 120]);
  const interaction = level >= 8 ? pick([30, 60]) : 0;
  const angleAt = (row: number, col: number) => (
    baseAngle + row * rowStep + col * colStep + row * col * interaction
  );

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (idx !== 8) grid[idx] = clockConfig(angleAt(row, col));
    }
  }

  const correctAngle = normalizeRotation(angleAt(2, 2));
  return makeCaptchaPuzzle(
    grid,
    clockConfig(correctAngle),
    [
      clockConfig(correctAngle + rowStep),
      clockConfig(correctAngle + colStep),
      clockConfig(correctAngle + Math.max(30, interaction || 90)),
      clockConfig(correctAngle + 180),
    ]
  );
}

function generateBarsPuzzle(level: number): CaptchaPuzzle {
  const grid: (CaptchaCell | null)[] = new Array(9).fill(null);
  const rowSeeds = shuffle([
    [1, 2, 3],
    [2, 3, 4],
    [4, 3, 2],
    [3, 1, 4],
    [2, 4, 1],
  ] as [number, number, number][]).slice(0, 3);
  const colDelta = shuffle([
    [0, 1, 0],
    [1, 0, 1],
    [2, -1, 1],
    [-1, 2, 0],
  ] as [number, number, number][]).slice(0, 3);
  const wrapHeight = (height: number) => ((height - 1 + 4) % 4) + 1;
  const heightsAt = (row: number, col: number): [number, number, number] => (
    rowSeeds[row].map((height, index) => (
      wrapHeight(height + colDelta[col][index] + (level >= 8 ? row * col : 0))
    )) as [number, number, number]
  );

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (idx !== 8) grid[idx] = barsConfig(heightsAt(row, col));
    }
  }

  const correctHeights = heightsAt(2, 2);
  return makeCaptchaPuzzle(
    grid,
    barsConfig(correctHeights),
    [
      barsConfig([correctHeights[1], correctHeights[2], correctHeights[0]]),
      barsConfig([correctHeights[0], wrapHeight(correctHeights[1] + 1), correctHeights[2]]),
      barsConfig([wrapHeight(correctHeights[0] - 1), correctHeights[1], wrapHeight(correctHeights[2] + 1)]),
      barsConfig([4, 1, 3]),
    ]
  );
}

function generateLetterPairPuzzle(level: number): CaptchaPuzzle {
  const grid: (CaptchaCell | null)[] = new Array(9).fill(null);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const leftBase = Math.floor(Math.random() * 8);
  const rightBase = Math.floor(Math.random() * 8) + 10;
  const leftRowStep = pick([1, 2, 3]);
  const leftColStep = pick(level >= 6 ? [2, 4, 5] : [1, 2, 3]);
  const rightRowStep = pick(level >= 6 ? [3, 4, 6] : [1, 3, 4]);
  const rightColStep = pick([1, 2, 5]);
  const valueAt = (row: number, col: number) => {
    const left = alphabet[(leftBase + row * leftRowStep + col * leftColStep) % alphabet.length];
    const right = alphabet[(rightBase + row * rightRowStep - col * rightColStep + alphabet.length * 4) % alphabet.length];
    return `${left}${right}`;
  };

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (idx !== 8) grid[idx] = textConfig(valueAt(row, col));
    }
  }

  const correctValue = valueAt(2, 2);
  const [left, right] = correctValue;
  return makeCaptchaPuzzle(
    grid,
    textConfig(correctValue),
    [
      textConfig(`${right}${left}`),
      textConfig(`${alphabet[(alphabet.indexOf(left) + 1) % alphabet.length]}${right}`),
      textConfig(`${left}${alphabet[(alphabet.indexOf(right) + 2) % alphabet.length]}`),
      textConfig(valueAt(1, 2)),
    ]
  );
}

/**
 * Core dynamic puzzle configurations per level (completely randomized per request)
 */
/**
 * Core dynamic puzzle configurations per level.
 * Difficulty ramps from one visible rule to multi-attribute second-order rules.
 */
export function generatePuzzle(level: number): CaptchaPuzzle {
  const nonShapeGenerators = [
    generateNumberSequencePuzzle,
    generateLetterSeriesPuzzle,
    generateLetterPairPuzzle,
    generateDominoPuzzle,
    generateTileLogicPuzzle,
    generateClockPuzzle,
    generateBarsPuzzle,
  ];
  const nonShapeChance = level <= 2 ? 0.35 : level <= 5 ? 0.45 : level <= 8 ? 0.55 : 0.65;

  if (Math.random() < nonShapeChance) {
    return pick(nonShapeGenerators)(level);
  }

  const grid: (CaptchaCell | null)[] = new Array(9).fill(null);
  const shapeTypes: ShapeType[] = ['circle', 'triangle', 'square', 'hexagon', 'star', 'arrow', 'cross'];
  const rotatableShapes: ShapeType[] = ['triangle', 'star', 'arrow'];

  const placeGrid = (factory: (row: number, col: number) => ShapeConfig) => {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        if (idx !== 8) grid[idx] = factory(row, col);
      }
    }
  };

  if (level === 1) {
    const shape = pick(shapeTypes);
    const baseRotation = pick([0, 90, 180, 270]);
    const counts = Math.random() > 0.5 ? [1, 2, 3] : [3, 2, 1];
    const axis = pick(['row', 'col', 'diagonal'] as const);

    placeGrid((row, col) => {
      const index = axis === 'row' ? col : axis === 'col' ? row : (row + col) % 3;
      return shapeConfig(shape, counts[index], baseRotation);
    });

    const correctCount = counts[axis === 'diagonal' ? 1 : 2];
    const correctChoice = shapeConfig(shape, correctCount, baseRotation);
    const distractors = [
      ...[1, 2, 3]
        .filter((count) => count !== correctCount)
        .map((count) => shapeConfig(shape, count, baseRotation)),
      shapeConfig(pick(shapeTypes.filter((type) => type !== shape)), correctCount, baseRotation),
    ];

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  if (level === 2) {
    const selectedShapes = shuffle(shapeTypes).slice(0, 3);
    const count = pick([1, 2]);
    const baseRotation = pick([0, 90, 180, 270]);
    const axis = pick(['row', 'col', 'diagonal'] as const);

    placeGrid((row, col) => {
      const index = axis === 'row' ? row : axis === 'col' ? col : (row + col) % 3;
      return shapeConfig(selectedShapes[index], count, baseRotation);
    });

    const correctShape = selectedShapes[axis === 'diagonal' ? 1 : 2];
    const correctChoice = shapeConfig(correctShape, count, baseRotation);
    const distractors = shapeTypes
      .filter((shape) => shape !== correctShape)
      .slice(0, 3)
      .map((shape) => shapeConfig(shape, count, baseRotation));

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  if (level === 3) {
    const shape = pick(rotatableShapes);
    const count = pick([1, 2]);
    const step = pick([45, 90, 120]) * pick([1, -1]);
    const baseRotation = pick([0, 45, 90, 135, 180, 225, 270, 315]);
    const axis = pick(['row', 'col', 'sum'] as const);

    placeGrid((row, col) => {
      const index = axis === 'row' ? row : axis === 'col' ? col : row + col;
      return shapeConfig(shape, count, baseRotation + index * step);
    });

    const correctIndex = axis === 'sum' ? 4 : 2;
    const correctRot = normalizeRotation(baseRotation + correctIndex * step);
    const correctChoice = shapeConfig(shape, count, correctRot);
    const distractors = [45, 90, 180].map((offset) => shapeConfig(shape, count, correctRot + offset));

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  if (level === 4) {
    const selectedShapes = shuffle(shapeTypes).slice(0, 3);
    const counts = shuffle([1, 2, 3]);
    const baseRotation = pick([0, 90, 180, 270]);
    const shapeByRow = Math.random() > 0.5;

    placeGrid((row, col) => (
      shapeConfig(
        selectedShapes[shapeByRow ? row : col],
        counts[shapeByRow ? col : row],
        baseRotation
      )
    ));

    const correctShape = selectedShapes[2];
    const correctCount = counts[2];
    const correctChoice = shapeConfig(correctShape, correctCount, baseRotation);
    const distractors = [
      shapeConfig(correctShape, counts[0], baseRotation),
      shapeConfig(selectedShapes[0], correctCount, baseRotation),
      shapeConfig(selectedShapes[1], counts[1], baseRotation),
    ];

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  if (level === 5) {
    const selectedShapes = shuffle(shapeTypes).slice(0, 3);
    const counts = shuffle([1, 2, 3]);
    const shift = pick([1, 2]);
    const baseRotation = pick([0, 90, 180, 270]);

    placeGrid((row, col) => {
      const shapeOffset = (row + col * shift) % 3;
      const countOffset = (col + row * shift) % 3;
      return shapeConfig(selectedShapes[shapeOffset], counts[countOffset], baseRotation);
    });

    const correctShape = selectedShapes[(2 + 2 * shift) % 3];
    const correctCount = counts[(2 + 2 * shift) % 3];
    const correctChoice = shapeConfig(correctShape, correctCount, baseRotation);
    const distractors = [
      shapeConfig(correctShape, counts[(counts.indexOf(correctCount) + 1) % 3], baseRotation),
      shapeConfig(selectedShapes[(selectedShapes.indexOf(correctShape) + 1) % 3], correctCount, baseRotation),
      shapeConfig(selectedShapes[(selectedShapes.indexOf(correctShape) + 2) % 3], counts[(counts.indexOf(correctCount) + 2) % 3], baseRotation),
    ];

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  if (level === 6) {
    const selectedShapes = shuffle(shapeTypes).slice(0, 3);
    const counts = shuffle([1, 2, 3]);
    const rotStep = pick([45, 90]);
    const baseRotation = pick([0, 45, 90, 135]);
    const variant = pick(['rowRotation', 'colRotation'] as const);

    placeGrid((row, col) => {
      const offset = (row + col) % 3;
      const rotationIndex = variant === 'rowRotation' ? row : col;
      return shapeConfig(selectedShapes[offset], counts[(row + 2 * col) % 3], baseRotation + rotationIndex * rotStep);
    });

    const correctShape = selectedShapes[1];
    const correctCount = counts[0];
    const correctRot = normalizeRotation(baseRotation + 2 * rotStep);
    const correctChoice = shapeConfig(correctShape, correctCount, correctRot);
    const distractors = [
      shapeConfig(correctShape, counts[1], correctRot),
      shapeConfig(selectedShapes[0], correctCount, correctRot),
      shapeConfig(correctShape, correctCount, correctRot + 90),
    ];

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  if (level === 7) {
    const shape = pick(rotatableShapes);
    const counts = shuffle([1, 2, 3]);
    const baseRotation = pick([0, 45, 90, 135, 180, 225, 270, 315]);
    const rowStep = pick([30, 45, 60]) * pick([1, -1]);
    const colStep = pick([45, 60, 90]) * pick([1, -1]);

    placeGrid((row, col) => (
      shapeConfig(shape, counts[(row + col) % 3], baseRotation + row * rowStep + col * colStep)
    ));

    const correctCount = counts[1];
    const correctRot = normalizeRotation(baseRotation + 2 * rowStep + 2 * colStep);
    const correctChoice = shapeConfig(shape, correctCount, correctRot);
    const distractors = [
      shapeConfig(shape, correctCount, correctRot + 60),
      shapeConfig(shape, counts[0], correctRot),
      shapeConfig(shape, counts[2], correctRot + 120),
    ];

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  if (level === 8) {
    const selectedShapes = shuffle(shapeTypes).slice(0, 3);
    const counts = shuffle([1, 2, 3]);
    const baseRotation = pick([0, 30, 60, 90, 120, 150]);
    const rowStep = pick([30, 45, 60]);
    const colStep = pick([60, 75, 90]);
    const shapeShift = pick([1, 2]);

    placeGrid((row, col) => (
      shapeConfig(
        selectedShapes[(row * shapeShift + col) % 3],
        counts[(row + 2 * col) % 3],
        baseRotation + row * rowStep + col * colStep
      )
    ));

    const correctShape = selectedShapes[(2 * shapeShift + 2) % 3];
    const correctCount = counts[0];
    const correctRot = normalizeRotation(baseRotation + 2 * rowStep + 2 * colStep);
    const correctChoice = shapeConfig(correctShape, correctCount, correctRot);
    const distractors = [
      shapeConfig(correctShape, correctCount, correctRot + 45),
      shapeConfig(selectedShapes[(selectedShapes.indexOf(correctShape) + 1) % 3], correctCount, correctRot),
      shapeConfig(correctShape, counts[1], correctRot),
    ];

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  if (level === 9) {
    const shape = pick(rotatableShapes);
    const counts = shuffle([1, 2, 3]);
    const baseRotation = pick([0, 30, 60, 90, 120, 150, 180]);
    const rowStep = pick([20, 30, 40, 50]);
    const colStep = pick([30, 45, 60, 75]);
    const interactionStep = pick([15, 30, 45]);

    placeGrid((row, col) => (
      shapeConfig(
        shape,
        counts[(row + col) % 3],
        baseRotation + row * rowStep + col * colStep + row * col * interactionStep
      )
    ));

    const correctCount = counts[1];
    const correctRot = normalizeRotation(baseRotation + 2 * rowStep + 2 * colStep + 4 * interactionStep);
    const correctChoice = shapeConfig(shape, correctCount, correctRot);
    const distractors = [
      shapeConfig(shape, correctCount, correctRot + interactionStep),
      shapeConfig(shape, counts[0], correctRot),
      shapeConfig(shape, counts[2], correctRot + 90),
    ];

    return makeCaptchaPuzzle(grid, correctChoice, distractors);
  }

  const selectedShapes = shuffle(rotatableShapes).slice(0, 3);
  const counts = shuffle([1, 2, 3]);
  const baseRotation = pick([7, 19, 31, 43, 55, 67, 79, 91]);
  const rowStep = pick([17, 23, 29, 31]) * pick([1, -1]);
  const colStep = pick([19, 27, 37, 41]) * pick([1, -1]);
  const interactionStep = pick([11, 13, 17, 19]) * pick([1, -1]);
  const secondOrderStep = pick([5, 7, 11]) * pick([1, -1]);
  const shapeShift = pick([1, 2]);

  placeGrid((row, col) => (
    shapeConfig(
      selectedShapes[(row * shapeShift + col) % 3],
      counts[(2 * row + col) % 3],
      baseRotation +
        row * rowStep +
        col * colStep +
        row * col * interactionStep +
        (row * row + col * col) * secondOrderStep
    )
  ));

  const correctShape = selectedShapes[(2 * shapeShift + 2) % 3];
  const correctCount = counts[0];
  const correctRot = normalizeRotation(
    baseRotation + 2 * rowStep + 2 * colStep + 4 * interactionStep + 8 * secondOrderStep
  );
  const correctChoice = shapeConfig(correctShape, correctCount, correctRot);
  const distractors = [
    shapeConfig(correctShape, correctCount, correctRot + 11),
    shapeConfig(correctShape, counts[1], correctRot),
    shapeConfig(selectedShapes[(selectedShapes.indexOf(correctShape) + 1) % 3], correctCount, correctRot + 19),
  ];

  return makeCaptchaPuzzle(grid, correctChoice, distractors);
}

/**
 * B&W shared SVG definitions.
 */
const SVG_DEFS = `
  <defs>
    <!-- Simple monochrome dot grid -->
    <pattern id="bwDotGrid" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="0.8" fill="#888888" opacity="0.3" />
    </pattern>
  </defs>
`;

/**
 * Render the main question board (360x360 SVG) with white background.
 */
export function renderQuestionSvg(grid: (CaptchaCell | null)[], level = 1): string {
  const width = 360;
  const height = 360;
  const cellSize = 120;
  
  let cellsSvg = '';
  
  for (let idx = 0; idx < 9; idx++) {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const startX = col * cellSize;
    const startY = row * cellSize;
    
    const cardMargin = 4;
    const cx = startX + cardMargin;
    const cy = startY + cardMargin;
    const cw = cellSize - cardMargin * 2;
    const ch = cellSize - cardMargin * 2;
    
    // Flat monochrome cards: solid off-white background with light grey border
    cellsSvg += `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#fbfbfb" stroke="#e0e0e0" stroke-width="1.5" />`;
    
    if (idx === 8) {
      const centerX = startX + cellSize / 2;
      const centerY = startY + cellSize / 2;
      cellsSvg += `
        <circle cx="${centerX}" cy="${centerY}" r="28" fill="none" stroke="#999999" stroke-width="1.5" stroke-dasharray="3 3" />
        <text x="${centerX}" y="${centerY + 10}" font-size="30" font-family="Courier New, monospace" font-weight="bold" fill="#000000" text-anchor="middle">?</text>
      `;
    } else {
      const config = grid[idx];
      if (config) {
        cellsSvg += renderCellContents(config, startX, startY, cellSize, level);
      }
    }
  }
  
  const noiseSvg = generateNoise(width, height, level);
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: #ffffff; border: 2px solid #000000;">
      ${SVG_DEFS}
      <!-- Noise background -->
      ${noiseSvg}
      <!-- Grid items -->
      ${cellsSvg}
    </svg>
  `.trim();
}

/**
 * Render a single choice option (120x120 SVG) in white background.
 */
export function renderChoiceSvg(config: CaptchaCell): string {
  const cellSize = 120;
  const padding = 4;
  const cw = cellSize - padding * 2;
  const ch = cellSize - padding * 2;
  
  const shapesSvg = renderCellContents(config, 0, 0, cellSize, 1); // standard render
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${cellSize}" height="${cellSize}" viewBox="0 0 ${cellSize} ${cellSize}" style="background-color: #ffffff;">
      ${SVG_DEFS}
      <rect x="${padding}" y="${padding}" width="${cw}" height="${ch}" fill="#fbfbfb" stroke="#e0e0e0" stroke-width="1.5" />
      ${shapesSvg}
    </svg>
  `.trim();
}

/**
 * Rasterizes an SVG string to PNG.
 */
export async function rasterizeSvg(svg: string): Promise<string> {
  try {
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.warn('sharp conversion failed, falling back to SVG base64.', error);
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
}
