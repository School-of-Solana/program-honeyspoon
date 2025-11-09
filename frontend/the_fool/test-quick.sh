#!/bin/bash
echo "Starting quick animation test..."
timeout 30 bun run test tests/animation-test.spec.ts --grep "Canvas Initialization" 2>&1 | tail -30
