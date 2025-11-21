import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameHUD } from '../GameHUD';

describe('GameHUD', () => {
  const mockDiveStats = {
    diveNumber: 3,
    survivalProbability: 0.75,
    multiplier: 1.5,
    depth: 150,
    threshold: 750,
    treasureReward: 1.5,
    expectedValue: 1.125,
  };

  const mockProps = {
    currentTreasure: 5.5,
    diveNumber: 3,
    currentDiveStats: mockDiveStats,
    isProcessing: false,
    onDiveDeeper: vi.fn(),
    onSurface: vi.fn(),
    onPlaySound: vi.fn(),
  };

  it('should render HUD with treasure amount', () => {
    render(<GameHUD {...mockProps} />);
    
    expect(screen.getByText('5.5 SOL')).toBeInTheDocument();
    expect(screen.getByText('TREASURE')).toBeInTheDocument();
  });

  it('should display survival probability', () => {
    render(<GameHUD {...mockProps} />);
    
    expect(screen.getByText('SURVIVAL CHANCE:')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should show dive deeper button', () => {
    render(<GameHUD {...mockProps} />);
    
    const diveButton = screen.getByText('DIVE DEEPER');
    expect(diveButton).toBeInTheDocument();
  });

  it('should show surface button when dive number > 1', () => {
    render(<GameHUD {...mockProps} diveNumber={3} />);
    
    expect(screen.getByText('SURFACE')).toBeInTheDocument();
  });

  it('should not show surface button on first dive', () => {
    render(<GameHUD {...mockProps} diveNumber={1} />);
    
    expect(screen.queryByText('SURFACE')).not.toBeInTheDocument();
  });

  it('should call onDiveDeeper when dive button clicked', () => {
    render(<GameHUD {...mockProps} />);
    
    const diveButton = screen.getByText('DIVE DEEPER');
    fireEvent.click(diveButton);
    
    expect(mockProps.onPlaySound).toHaveBeenCalledWith('BUTTON_CLICK');
    expect(mockProps.onDiveDeeper).toHaveBeenCalled();
  });

  it('should call onSurface when surface button clicked', () => {
    render(<GameHUD {...mockProps} />);
    
    const surfaceButton = screen.getByText('SURFACE');
    fireEvent.click(surfaceButton);
    
    expect(mockProps.onPlaySound).toHaveBeenCalledWith('BUTTON_CLICK');
    expect(mockProps.onSurface).toHaveBeenCalled();
  });

  it('should disable buttons when processing', () => {
    render(<GameHUD {...mockProps} isProcessing={true} />);
    
    const diveButton = screen.getByText('DIVING...');
    expect(diveButton).toBeDisabled();
    expect(diveButton).toHaveClass('is-disabled');
  });

  it('should show "DIVING..." text when processing', () => {
    render(<GameHUD {...mockProps} isProcessing={true} />);
    
    expect(screen.getByText('DIVING...')).toBeInTheDocument();
    expect(screen.queryByText('DIVE DEEPER')).not.toBeInTheDocument();
  });

  it('should update survival probability display correctly', () => {
    const { rerender } = render(<GameHUD {...mockProps} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    
    // Update stats
    rerender(
      <GameHUD
        {...mockProps}
        currentDiveStats={{
          ...mockDiveStats,
          survivalProbability: 0.50,
        }}
      />
    );
    
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should update treasure amount display correctly', () => {
    const { rerender } = render(<GameHUD {...mockProps} />);
    expect(screen.getByText('5.5 SOL')).toBeInTheDocument();
    
    // Update treasure
    rerender(<GameHUD {...mockProps} currentTreasure={10.25} />);
    
    expect(screen.getByText('10.25 SOL')).toBeInTheDocument();
  });
});
