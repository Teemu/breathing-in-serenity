import * as w4 from "./wasm4";

const SCREEN = 160;
const TREE_BASE_X = SCREEN / 2;
const TREE_BASE_Y = SCREEN - 15;
const TREE_HEIGHT = 40;
const GROUND_SIZE = 30;
enum TREE_MODES {
  MAIN_TREE = 0,
  MAIN_TREE_BACKGROUND = 1,
  MAIN_TREE_BACKGROUND_EXTRA_BRANCH = 2,
  BACKGROUND_TREE = 3,
}
enum BUTTON_MODES {
  BUTTON_UNPRESSED = 0,
  BUTTON_START = 1,
  BUTTON_DOWN = 2,
}

let frameCount = 0;
let effectBreath: f64 = 0.0;
let effectDeath = false;
let poemTextPosition = 0;
let poemIndex = 0;
let buttonPressed: i32 = 0;
let buttonCooldown: bool = false;
let buttonLeftRight: f64 = 0.0;
let buttonDownTop: f64 = 0.0;

const POEM = [
  "",
  "As a tree sways\nin the gentle\nbreeze",
  "Savor moments\nsuch as these",
  "Let the past\nand tomorrows\ncease",
  "",
  "Hear the rhythm\nof your breath",
  "Here in this\nmoment",
  "there is\nno death",
  "",
  "",
  "In life's grand\njourney",
  "I wish you well",
  "",
  "Teemu",
];

export function start(): void {
  store<u32>(w4.PALETTE, 0xf3deba, 0 * sizeof<u32>()); // Background
  store<u32>(w4.PALETTE, 0xa9907e, 1 * sizeof<u32>()); // Ground / Background trees
  store<u32>(w4.PALETTE, 0x675d50, 2 * sizeof<u32>()); // Tree
  store<u32>(w4.PALETTE, 0xabc4aa, 3 * sizeof<u32>()); // Leaf
}

function drawClouds(): void {
  store<u16>(w4.DRAW_COLORS, 0x22);

  const RANDOM_CLOUD_ADJUSTMENT = 70;
  const SCREEN_PLUS = SCREEN + RANDOM_CLOUD_ADJUSTMENT * 2;
  const CLOUD_SPEED = 0.05;
  for (let i = 0; i < 7; i++) {
    const randomLocation = i * 300 + Math.sin(i * 123.456) * 100;
    const x = (SCREEN -
      (((randomLocation + SCREEN_PLUS + frameCount * CLOUD_SPEED) %
        SCREEN_PLUS) -
        RANDOM_CLOUD_ADJUSTMENT)) as i32;
    const adjustCloudSize = 1.0 - i * 0.04;
    const cloudY = (25 + Math.cos(i * 123.456) * 20.0) as i32;
    w4.oval(
      x - 8,
      cloudY,
      (30 * adjustCloudSize) as i32 as i32,
      (15 * adjustCloudSize) as i32,
    );
    w4.oval(
      x - 4,
      cloudY,
      (30 * adjustCloudSize) as i32,
      (15 * adjustCloudSize) as i32,
    );
    w4.oval(
      x - 4,
      cloudY + 6,
      (30 * adjustCloudSize) as i32,
      (15 * adjustCloudSize) as i32,
    );
    w4.oval(
      x,
      cloudY,
      (30 * adjustCloudSize) as i32,
      (15 * adjustCloudSize) as i32,
    );
    w4.rect(
      x - 6,
      cloudY + 2,
      (25 * adjustCloudSize) as i32,
      (10 * adjustCloudSize) as i32,
    );
  }
}

function drawLine(x1: i32, y1: i32, x2: i32, y2: i32, size: i32 = 6): void {
  let dx: i32 = Math.abs(x2 - x1) as i32;
  let dy: i32 = Math.abs(y2 - y1) as i32;

  let sx: i32 = x1 < x2 ? 1 : -1;
  let sy: i32 = y1 < y2 ? 1 : -1;

  let err: i32 = dx - dy;

  while (true) {
    w4.oval(x1 - size / 2, y1 - size / 2, size, size);

    if (x1 === x2 && y1 === y2) break;

    let e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x1 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y1 += sy;
    }
  }
}

function interpolate(x1: i32, x2: i32, i: f64): i32 {
  return ((1.0 - i) * (x1 as f64) + (x2 as f64) * i) as i32;
}

function drawLeaf(x: i32, y: i32, size: i32, i: i32): void {
  if (effectDeath) {
    return;
  }
  let randomNumberWithXY =
    Math.sin(x * 123.46235 + y * 412.6325235) * 0.5 + 0.5;
  if (poemIndex <= 0) {
    if (
      (i + 1) * 20 + randomNumberWithXY * 20 - y * 0.25 >
      (frameCount - 50) * 1
    ) {
      return;
    }
    if (i <= 2 && frameCount - 50 < 100) {
      return;
    }
  }

  store<u16>(w4.DRAW_COLORS, 0x44);

  w4.oval(x, y, size, size);
}

function drawBranch(
  x: i32,
  y: i32,
  length: i32,
  angle: f32,
  depth: i32 = 0,
  branchHorizontalPosition: i32 = 0,
  treeMode: i32 = 0,
): void {
  // Draw a leaf at the end of a branch
  if (length < 2) {
    if (treeMode == TREE_MODES.MAIN_TREE) {
      drawLeaf(x, y, 4, depth);
    }
    return;
  }

  const endX = (x + Math.sin(angle) * length) as i32;
  const endY = (y + Math.cos(angle) * length) as i32;

  if (
    treeMode == TREE_MODES.MAIN_TREE ||
    treeMode == TREE_MODES.MAIN_TREE_BACKGROUND ||
    treeMode == TREE_MODES.MAIN_TREE_BACKGROUND_EXTRA_BRANCH
  ) {
    store<u16>(w4.DRAW_COLORS, 0x33);
  } else {
    store<u16>(w4.DRAW_COLORS, 0x22);
  }
  drawLine(x as i32, y, endX, endY, Math.max(6 - depth, 1) as i32);

  let effectBreathUse: f64 = 0;
  if (treeMode != TREE_MODES.BACKGROUND_TREE) {
    effectBreathUse = effectBreath;
  }

  const adjustAngleLeft = (((Math.sin(frameCount * 0.01) * 0.1) as f32) +
    effectBreathUse *
      (Math.sin(branchHorizontalPosition * 64.41367) * 0.6)) as f32;
  const adjustAngleRight = (((Math.sin(frameCount * 0.01) * 0.1 +
    Math.sin(frameCount * 0.01 + 123.456) * 0.05) as f32) +
    effectBreathUse * (Math.sin(depth * 64.41367) * 0.6)) as f32;

  const interactiveAdjustment: f32 =
    treeMode != TREE_MODES.BACKGROUND_TREE
      ? ((buttonLeftRight * 0.7) as f32)
      : (0.0 as f32);
  const adjustAngle: f32 = (interactiveAdjustment +
    0.5 +
    0.1 *
      Math.sin(
        depth * 1234.5678 + branchHorizontalPosition * 4265.27625,
      )) as f32;

  // Draw leafs for the main tree background layer
  if (treeMode == TREE_MODES.MAIN_TREE_BACKGROUND_EXTRA_BRANCH) {
    drawLeaf(x, y, 4, depth);
  }

  // Primary branches
  drawBranch(
    endX,
    endY,
    (length * (0.7 + effectBreathUse * 0.05)) as i32,
    angle - adjustAngle + adjustAngleLeft,
    depth + 1,
    branchHorizontalPosition - 1,
    treeMode,
  );
  drawBranch(
    endX,
    endY,
    (length * (0.7 + effectBreathUse * 0.05)) as i32,
    angle + adjustAngle + adjustAngleRight,
    depth + 1,
    branchHorizontalPosition + 1,
    treeMode,
  );

  // Main tree background branches
  if (treeMode == TREE_MODES.MAIN_TREE_BACKGROUND) {
    drawBranch(
      endX,
      endY,
      (length * 0.4) as i32,
      angle - adjustAngle + adjustAngleLeft - 0.4,
      depth + 1,
      branchHorizontalPosition - 1,
      TREE_MODES.MAIN_TREE_BACKGROUND_EXTRA_BRANCH,
    );
    drawBranch(
      endX,
      endY,
      (length * 0.4) as i32,
      angle + adjustAngle + adjustAngleRight + 0.4,
      depth + 1,
      branchHorizontalPosition + 1,
      TREE_MODES.MAIN_TREE_BACKGROUND_EXTRA_BRANCH,
    );
    drawBranch(
      endX,
      endY,
      (length * 0.6) as i32,
      angle + adjustAngle + adjustAngleRight - 0.6,
      depth + 3,
      branchHorizontalPosition + 1,
      TREE_MODES.MAIN_TREE_BACKGROUND_EXTRA_BRANCH,
    );
    drawBranch(
      endX,
      endY,
      (length * 0.6) as i32,
      angle + adjustAngle + adjustAngleRight + 0.6,
      depth + 3,
      branchHorizontalPosition + 1,
      TREE_MODES.MAIN_TREE_BACKGROUND_EXTRA_BRANCH,
    );
  }

  // Extra leafs for the main tree
  if (treeMode == TREE_MODES.MAIN_TREE && depth > 1) {
    drawLeaf(x, y, 4, depth);
  }
}

function drawRoots(x: i32, y: i32, y2: i32): void {
  store<u16>(w4.DRAW_COLORS, 0x33);

  for (let k: f32 = 0; k < 30; k += 2) {
    let ii: f64 = 1.0 - (k * 1.0) / 30.0;
    let size: f64 = Math.max(5, 20.0 * 0.1 * ii + 5);
    let ii2: f64 = Math.pow(ii, 2.0);
    for (let k2 = -7; k2 < 7; k2++) {
      w4.oval(
        ((x as f32) - size * 0.5 + k2 * ii2) as i32,
        ((((y as f32) - k) as f32) - size * 0.5) as i32,
        size as i32,
        size as i32,
      );
    }
  }
}

function drawGround(): void {
  store<u16>(w4.DRAW_COLORS, 0x22);
  for (let i = 0; i <= SCREEN + GROUND_SIZE; i += 7) {
    const height = Math.round(10 + Math.sin(i / 30.0) * 5);
    w4.oval(
      i - GROUND_SIZE,
      (SCREEN - height - GROUND_SIZE * 0.5) as i32,
      GROUND_SIZE,
      GROUND_SIZE,
    );
  }
}

function drawBackgroundTrees(): void {
  drawBranch(
    (SCREEN * 0.1) as i32,
    SCREEN - 15,
    (TREE_HEIGHT * 0.7) as i32,
    (-Math.PI as f32) - 0.1,
    0,
    13,
    TREE_MODES.BACKGROUND_TREE,
  );
  drawBranch(
    (SCREEN * 0.3) as i32,
    SCREEN + 0,
    (TREE_HEIGHT * 0.5) as i32,
    (-Math.PI as f32) + 0.1,
    0,
    14,
    TREE_MODES.BACKGROUND_TREE,
  );
  drawBranch(
    (SCREEN * 0.6) as i32,
    SCREEN + 0,
    (TREE_HEIGHT * 0.4) as i32,
    (-Math.PI as f32) + 0.1,
    2,
    19,
    TREE_MODES.BACKGROUND_TREE,
  );
  drawBranch(
    (SCREEN * 0.44) as i32,
    SCREEN - 0,
    (TREE_HEIGHT * 0.7) as i32,
    (-Math.PI as f32) - 0.1,
    0,
    16,
    TREE_MODES.BACKGROUND_TREE,
  );
  drawBranch(
    (SCREEN * 0.8) as i32,
    SCREEN - 0,
    (TREE_HEIGHT * 0.7) as i32,
    (-Math.PI as f32) - 0.1,
    0,
    16,
    TREE_MODES.BACKGROUND_TREE,
  );
  drawBranch(
    (SCREEN * 0.55) as i32,
    SCREEN - 0,
    (TREE_HEIGHT * 0.7) as i32,
    (-Math.PI as f32) - 0.1,
    0,
    16,
    TREE_MODES.BACKGROUND_TREE,
  );
  drawBranch(
    (SCREEN * 0.7) as i32,
    SCREEN - 20,
    (TREE_HEIGHT * 0.8) as i32,
    (-Math.PI as f32) + 0.1,
    0,
    15,
    TREE_MODES.BACKGROUND_TREE,
  );
  drawBranch(
    (SCREEN * 0.9) as i32,
    SCREEN - 10,
    (TREE_HEIGHT * 0.7) as i32,
    (-Math.PI as f32) - 0.1,
    0,
    16,
    TREE_MODES.BACKGROUND_TREE,
  );
}

function drawMainTree(): void {
  //const interactiveLengthAdjustment: f32 = buttonDownTop;
  // buttonDownTop is
  // -1 - 1
  // to 1 +- 0.5
  const interactiveLengthAdjustment = (1 + buttonDownTop * 0.5) as f32;

  drawBranch(
    TREE_BASE_X,
    TREE_BASE_Y,
    ((TREE_HEIGHT as f32) * interactiveLengthAdjustment) as i32,
    -Math.PI as f32,
    0,
    0,
    TREE_MODES.MAIN_TREE_BACKGROUND,
  );
  drawBranch(
    TREE_BASE_X,
    TREE_BASE_Y,
    ((TREE_HEIGHT as f32) * interactiveLengthAdjustment) as i32,
    -Math.PI as f32,
    0,
    0,
    TREE_MODES.MAIN_TREE,
  );
  drawRoots(TREE_BASE_X, TREE_BASE_Y, SCREEN - 50);
}

function drawText(): void {
  store<u16>(w4.DRAW_COLORS, 0x34);
  if (poemIndex < POEM.length) {
    const selectedText = POEM[poemIndex];
    const firstLine = selectedText.split("\n")[0];
    const visibleText = selectedText.substr(0, poemTextPosition);
    if (frameCount % 5 == 0) {
      poemTextPosition += 1;
      if (
        selectedText.length != 0 &&
        poemTextPosition < selectedText.length &&
        selectedText.charCodeAt(poemTextPosition) != 32
      ) {
        w4.tone(
          220 | (0 << 16),
          (0 << 24) | (0 << 16) | 0 | (16 << 8),
          99,
          w4.TONE_MODE2,
        );
      }
    }

    if (buttonPressed == BUTTON_MODES.BUTTON_START && !buttonCooldown) {
      if (poemTextPosition < selectedText.length) {
        poemTextPosition = selectedText.length;
      } else if (poemTextPosition >= selectedText.length) {
        poemIndex += 1;
        if (poemIndex < POEM.length && POEM[poemIndex] == "") {
          poemIndex += 1;
        }

        poemTextPosition = 0;
      }
      buttonCooldown = true;
    }
    if (buttonPressed == BUTTON_MODES.BUTTON_UNPRESSED) {
      buttonCooldown = false;
    }

    // Center text
    let textX = (SCREEN * 0.5 - firstLine.length * 8 * 0.5) as i32;

    // Draw text
    w4.text(visibleText, textX, (SCREEN * 0.77) as i32);

    // # Effects

    // Enlarge tree when poem has "breah" word
    if (selectedText.includes("breath")) {
      effectBreath = Math.min(1.0, effectBreath + 0.02);
    } else {
      effectBreath = Math.max(0, effectBreath - 0.001);
    }

    // Make tree black when poem has "death" word
    if (visibleText.includes("death")) {
      effectDeath = true;
    } else {
      effectDeath = false;
    }

    if (poemTextPosition > selectedText.length + 100) {
      poemIndex += 1;
      poemTextPosition = 0;
    }
  } else {
    if (
      buttonPressed == BUTTON_MODES.BUTTON_DOWN ||
      buttonPressed == BUTTON_MODES.BUTTON_START
    ) {
      effectBreath = Math.min(1.0, effectBreath + 0.2);
    } else {
      effectBreath = Math.max(0, effectBreath - 0.1);
    }
  }
}

export function update(): void {
  frameCount += 1;

  store<u16>(w4.DRAW_COLORS, 2);

  const gamepad = load<u8>(w4.GAMEPAD1);
  if (gamepad & w4.BUTTON_1) {
    if (buttonPressed == BUTTON_MODES.BUTTON_UNPRESSED) {
      buttonPressed = BUTTON_MODES.BUTTON_START;
    } else if (buttonPressed == BUTTON_MODES.BUTTON_START) {
      buttonPressed = BUTTON_MODES.BUTTON_DOWN;
    }
  } else {
    buttonPressed = BUTTON_MODES.BUTTON_UNPRESSED;
  }

  if (gamepad & w4.BUTTON_LEFT) {
    buttonLeftRight = Math.max(-1.0, buttonLeftRight - 0.05);
  } else if (gamepad & w4.BUTTON_RIGHT) {
    buttonLeftRight = Math.min(1.0, buttonLeftRight + 0.05);
  } else {
    buttonLeftRight = buttonLeftRight * 0.97;
  }

  if (gamepad & w4.BUTTON_DOWN) {
    buttonDownTop = Math.max(-1.0, buttonDownTop - 0.02);
  } else if (gamepad & w4.BUTTON_UP) {
    buttonDownTop = Math.min(1.0, buttonDownTop + 0.02);
  } else {
    buttonDownTop = buttonDownTop * 0.95;
  }

  drawGround();
  drawClouds();
  drawBackgroundTrees();
  drawMainTree();
  drawText();
}
