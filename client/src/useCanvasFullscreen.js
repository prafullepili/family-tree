import { useEffect, useState } from 'react';

export default function useCanvasFullscreen(canvasRef) {
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  useEffect(() => {
    const syncFullscreenState = () => {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
      if (fullscreenElement) {
        setIsCanvasFullscreen(fullscreenElement === canvasRef.current);
        setFullscreenFallback(false);
      } else if (!fullscreenFallback) setIsCanvasFullscreen(false);
    };
    const closeFallbackOnEscape = (event) => {
      if (event.key === 'Escape' && fullscreenFallback) {
        setFullscreenFallback(false);
        setIsCanvasFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    window.addEventListener('keydown', closeFallbackOnEscape);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
      window.removeEventListener('keydown', closeFallbackOnEscape);
    };
  }, [fullscreenFallback]);
  async function toggleCanvasFullscreen() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (fullscreenFallback) {
      setFullscreenFallback(false);
      setIsCanvasFullscreen(false);
      return;
    }
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenElement) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFullscreen) await exitFullscreen.call(document);
      return;
    }
    const requestFullscreen = canvas.requestFullscreen || canvas.webkitRequestFullscreen;
    if (requestFullscreen) {
      try {
        await requestFullscreen.call(canvas);
        return;
      } catch {
        // Browsers may block the native API; the fixed canvas fallback still provides the mode.
      }
    }
    setFullscreenFallback(true);
    setIsCanvasFullscreen(true);
  }
  return { isCanvasFullscreen, fullscreenFallback, toggleCanvasFullscreen };
}

