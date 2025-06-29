import React from 'react';

interface ProgressBarProps {
  progress: number;
  colorClass?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getProgressClass(progress: number): string {
  const rounded = Math.round(progress);
  
  // Map to available progress classes
  if (rounded >= 100) return 'progress-100';
  if (rounded >= 95) return 'progress-95';
  if (rounded >= 90) return 'progress-90';
  if (rounded >= 85) return 'progress-85';
  if (rounded >= 80) return 'progress-80';
  if (rounded >= 75) return 'progress-75';
  if (rounded >= 70) return 'progress-70';
  if (rounded >= 65) return 'progress-65';
  if (rounded >= 60) return 'progress-60';
  if (rounded >= 55) return 'progress-55';
  if (rounded >= 50) return 'progress-50';
  if (rounded >= 45) return 'progress-45';
  if (rounded >= 40) return 'progress-40';
  if (rounded >= 35) return 'progress-35';
  if (rounded >= 30) return 'progress-30';
  if (rounded >= 25) return 'progress-25';
  if (rounded >= 20) return 'progress-20';
  if (rounded >= 15) return 'progress-15';
  if (rounded >= 10) return 'progress-10';
  if (rounded >= 5) return 'progress-5';
  if (rounded >= 1) return 'progress-1';
  return 'progress-0';
}

export default function ProgressBar({ 
  progress, 
  colorClass,
  color = 'blue',
  size = 'md',
  className = '' 
}: ProgressBarProps) {
  const progressClass = getProgressClass(progress);
  
  // If colorClass is provided, use the old method for backward compatibility
  if (colorClass) {
    return (
      <div className={`progress-container ${className}`}>
        <div className={`progress-bar ${colorClass} ${progressClass}`} />
      </div>
    );
  }

  // New method using color prop
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
    purple: 'bg-purple-500'
  };

  const backgroundClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    red: 'bg-red-100',
    gray: 'bg-gray-100',
    purple: 'bg-purple-100'
  };

  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const roundedProgress = Math.round(clampedProgress);
  const progressWidthClass = getProgressClass(clampedProgress);

  return (
    <div className={`w-full ${backgroundClasses[color]} rounded-full ${sizeClasses[size]} overflow-hidden ${className}`}>
      <div
        className={`progress-bar-dynamic ${colorClasses[color]} ${progressWidthClass}`}
        role="progressbar"
        title={`Progress: ${clampedProgress.toFixed(1)}%`}
      />
    </div>
  );
}
