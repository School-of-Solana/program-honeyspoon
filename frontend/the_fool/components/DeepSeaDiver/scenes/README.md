# Scenes Folder

This folder is designated for scene extraction from `OceanScene.tsx`.

## Current Status

The game currently has 3 main scenes defined in `OceanScene.tsx`:

1. **Beach Scene** (lines ~150-607)
   - Sky, sun, beach, decorations
   - Palm trees, rocks, shells, crabs, starfish
   - Seagulls, clouds
   - Boat with bobbing animation
   - **Status**: Reference implementation in `BeachScene.ts`

2. **Surfacing Scene** (lines ~445-607)
   - Rising animation back to surface
   - Treasure display
   - Success/celebration effects
   - **Status**: To be extracted

3. **Diving Scene** (lines ~608-end)
   - Underwater gameplay
   - Parallax scrolling
   - Creature spawning
   - Diving/surfacing mechanics
   - Death animations
   - **Status**: Main game logic, needs careful extraction

## Files

### BeachScene.ts
A reference implementation showing how the beach scene could be extracted.
Contains the complete beach setup logic as a standalone function.

**Current state**: Created but not integrated to avoid breaking changes.
**Future**: Can be integrated by replacing the beach scene definition in OceanScene.tsx.

## Why Not Fully Extracted?

The scenes are tightly coupled with:
- Shared refs (`depthRef`, `survivedRef`, etc.)
- Kaplay context dependencies
- Complex state management between scenes
- Event handlers and callbacks

Full extraction would require:
1. Careful state management design
2. Scene communication protocol
3. Extensive testing to ensure no regressions
4. Gradual migration approach

## Future Refactoring Steps

To fully extract scenes:

1. **Phase 1**: Extract pure setup logic (decorations, static elements)
   - ✅ Entities already extracted
   - ✅ BeachScene.ts created as reference
   
2. **Phase 2**: Define scene interfaces and contracts
   - Create SceneData types
   - Define scene lifecycle methods
   - Document dependencies

3. **Phase 3**: Extract one scene at a time
   - Start with Beach (simplest)
   - Then Surfacing (medium complexity)
   - Finally Diving (most complex)

4. **Phase 4**: Test thoroughly after each extraction
   - Run all tests
   - Manual gameplay testing
   - Verify no regressions

## Benefits of Extraction

- ✅ Better code organization (1148 lines → ~400 lines per scene)
- ✅ Easier to maintain and test individual scenes
- ✅ Clearer separation of concerns
- ✅ Reusable scene logic
- ✅ Better developer experience

## Current Organization (Already Improved!)

The codebase is already well-organized with:
- ✅ 13 entity files in `entities/` folder (654 lines extracted)
- ✅ Comprehensive test coverage (170+ tests)
- ✅ Error boundary for safety
- ✅ Clean constants file
- ✅ Scenes folder created and ready

**Note**: OceanScene.tsx at 1148 lines is manageable. Full scene extraction can be done as a future enhancement when/if needed.
