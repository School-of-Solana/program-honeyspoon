# Animation Bug Analysis

## Problem
Animation completes instantly (multiple times per second) instead of taking 2.5 seconds.

## Root Cause
The `divingUpdate` function is being added as an `onUpdate` handler to multiple objects.
Each time `triggerDivingAnimation()` is called, it adds NEW handlers without removing old ones.

The `elapsed` variable is captured in the closure, but if the function runs multiple times per frame,
`elapsed` increments rapidly.

## Solution
Instead of attaching `onUpdate` to individual objects, we should:
1. Have ONE central animation update function
2. Track animation state globally
3. Update all objects from that ONE function

This prevents duplicate handlers and ensures timing is correct.
