/**
 * Boat Entity - Creates a decorative boat on the beach scene
 */

import type { KAPLAYCtx, GameObj } from "kaplay";
import * as CONST from "../sceneConstants";

/**
 * Create a boat using geometric shapes
 * @param k - Kaplay context
 * @param x - X position
 * @param y - Y position
 * @param zIndex - Z-index layer (default: BOAT layer)
 * @returns Boat game object
 */
export function createBoat(
  k: KAPLAYCtx,
  x: number,
  y: number,
  zIndex: number = CONST.Z_LAYERS.BOAT
): GameObj {
  const boat = k.add([
    k.pos(x, y),
    k.anchor("center"),
    k.rotate(0),
    k.opacity(1),
    k.z(zIndex),
  ]);

  // Boat hull
  boat.add([
    k.polygon([
      k.vec2(-CONST.BOAT.HULL_WIDTH_LEFT, 0),
      k.vec2(-CONST.BOAT.HULL_WIDTH_RIGHT, CONST.BOAT.HULL_HEIGHT),
      k.vec2(CONST.BOAT.HULL_WIDTH_RIGHT, CONST.BOAT.HULL_HEIGHT),
      k.vec2(CONST.BOAT.HULL_WIDTH_LEFT, 0),
    ]),
    k.pos(0, 0),
    k.color(...CONST.COLORS.BOAT_HULL),
    k.outline(
      CONST.BOAT.OUTLINE_WIDTH,
      k.rgb(...CONST.COLORS.OUTLINE_BOAT_HULL)
    ),
  ]);

  // Deck planks
  for (
    let i = CONST.BOAT.DECK_PLANK_START;
    i < CONST.BOAT.DECK_PLANK_END;
    i += CONST.BOAT.DECK_PLANK_SPACING
  ) {
    boat.add([
      k.rect(CONST.BOAT.DECK_PLANK_WIDTH, CONST.BOAT.DECK_PLANK_HEIGHT),
      k.pos(i, -2),
      k.color(...CONST.COLORS.BOAT_DECK),
      k.anchor("center"),
    ]);
  }

  // Boat rail (left)
  boat.add([
    k.rect(CONST.BOAT.RAIL_WIDTH, CONST.BOAT.RAIL_HEIGHT),
    k.pos(-CONST.BOAT.RAIL_OFFSET_X, CONST.BOAT.RAIL_OFFSET_Y),
    k.color(...CONST.COLORS.BOAT_HULL),
    k.anchor("center"),
  ]);

  // Boat rail (right)
  boat.add([
    k.rect(CONST.BOAT.RAIL_WIDTH, CONST.BOAT.RAIL_HEIGHT),
    k.pos(CONST.BOAT.RAIL_OFFSET_X, CONST.BOAT.RAIL_OFFSET_Y),
    k.color(...CONST.COLORS.BOAT_HULL),
    k.anchor("center"),
  ]);

  // Mast
  boat.add([
    k.rect(CONST.BOAT.MAST_WIDTH, CONST.BOAT.MAST_HEIGHT),
    k.pos(CONST.BOAT.MAST_OFFSET_X, CONST.BOAT.MAST_OFFSET_Y),
    k.color(...CONST.COLORS.BOAT_HULL),
    k.anchor("bot"),
  ]);

  // Flag
  boat.add([
    k.polygon([
      k.vec2(0, 0),
      k.vec2(CONST.BOAT.FLAG_WIDTH, CONST.BOAT.FLAG_HEIGHT / 2),
      k.vec2(0, CONST.BOAT.FLAG_HEIGHT),
    ]),
    k.pos(CONST.BOAT.MAST_OFFSET_X, CONST.BOAT.FLAG_OFFSET_Y),
    k.color(...CONST.COLORS.BOAT_FLAG),
    k.outline(
      CONST.BOAT.OUTLINE_WIDTH_FLAG,
      k.rgb(...CONST.COLORS.OUTLINE_FLAG)
    ),
  ]);

  // Anchor rope coil
  boat.add([
    k.circle(CONST.BOAT.ANCHOR_ROPE_RADIUS),
    k.pos(CONST.BOAT.ANCHOR_ROPE_X, CONST.BOAT.ANCHOR_ROPE_Y),
    k.color(...CONST.COLORS.ANCHOR_ROPE),
    k.outline(
      CONST.BOAT.OUTLINE_WIDTH_THIN,
      k.rgb(...CONST.COLORS.OUTLINE_ANCHOR)
    ),
  ]);

  return boat;
}
