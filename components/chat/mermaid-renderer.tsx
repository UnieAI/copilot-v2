'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { KortixLoader } from '@/components/ui/kortix-loader';

// Global cache for rendered Mermaid diagrams
const mermaidCache = new Map<string, string>();
let mermaidInstance: any = null;

// Global cleanup function to remove any Mermaid error messages from the DOM
const cleanupMermaidErrors = () => {
  const allElements = document.querySelectorAll('div, span, p, text, tspan');
  let cleaned = 0;
  allElements.forEach(el => {
    const textContent = el.textContent || '';
    if (
      textContent.includes('Syntax error in text') ||
      textContent.includes('mermaid version') ||
      textContent.trim() === 'Syntax error in text'
    ) {
      el.remove();
      cleaned++;
    }
  });
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} Mermaid error elements`);
  }
};

interface MermaidRendererProps {
  chart: string;
  className?: string;
  enableFullscreen?: boolean;
  /** 當渲染失敗時呼叫（讓上層知道要顯示原始碼） */
  onError?: () => void;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = React.memo(
  ({ chart, className, enableFullscreen = true, onError }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [renderedContent, setRenderedContent] = useState<string>('');
    const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
    const [fullscreenRenderedContent, setFullscreenRenderedContent] = useState<string>('');

    // Create a stable hash for the chart content to enable caching
    const chartHash = useMemo(() => {
      let hash = 0;
      const trimmed = chart.trim();
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(36);
    }, [chart]);

    // Canvas state for fullscreen viewer
    const canvasRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

    // Periodic cleanup of stray error messages
    useEffect(() => {
      const cleanupInterval = setInterval(cleanupMermaidErrors, 5000);
      cleanupMermaidErrors(); // initial
      return () => {
        clearInterval(cleanupInterval);
        cleanupMermaidErrors();
      };
    }, []);

    // ────────────────────────────────────────────────
    //   Mouse / Touch / Wheel handlers for fullscreen
    // ────────────────────────────────────────────────

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (e.button === 0) {
          setIsDragging(true);
          setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        }
      },
      [panOffset]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (isDragging) {
          setPanOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
          });
        }
      },
      [isDragging, dragStart]
    );

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    const getTouchDistance = (touches: React.TouchList) => {
      if (touches.length < 2) return null;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: React.TouchList) => {
      if (touches.length === 0) return { x: 0, y: 0 };
      if (touches.length === 1) return { x: touches[0].clientX, y: touches[0].clientY };
      const x = (touches[0].clientX + touches[1].clientX) / 2;
      const y = (touches[0].clientY + touches[1].clientY) / 2;
      return { x, y };
    };

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
          setIsDragging(true);
          setDragStart({
            x: e.touches[0].clientX - panOffset.x,
            y: e.touches[0].clientY - panOffset.y,
          });
        } else if (e.touches.length === 2) {
          setLastTouchDistance(getTouchDistance(e.touches));
        }
      },
      [panOffset]
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (isDragging || (e.touches.length === 2 && lastTouchDistance !== null)) {
          e.preventDefault();
        }

        if (e.touches.length === 1 && isDragging) {
          setPanOffset({
            x: e.touches[0].clientX - dragStart.x,
            y: e.touches[0].clientY - dragStart.y,
          });
        } else if (e.touches.length === 2 && lastTouchDistance !== null) {
          const currentDistance = getTouchDistance(e.touches);
          if (currentDistance) {
            const zoomFactor = currentDistance / lastTouchDistance;
            const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));

            if (canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const center = getTouchCenter(e.touches);
              const cx = center.x - rect.left;
              const cy = center.y - rect.top;

              setPanOffset({
                x: cx - (cx - panOffset.x) * (newZoom / zoom),
                y: cy - (cy - panOffset.y) * (newZoom / zoom),
              });
            }

            setZoom(newZoom);
            setLastTouchDistance(currentDistance);
          }
        }
      },
      [isDragging, dragStart, lastTouchDistance, zoom, panOffset]
    );

    const handleTouchEnd = useCallback(() => {
      setIsDragging(false);
      setLastTouchDistance(null);
    }, []);

    const handleWheelEvent = useCallback(
      (e: WheelEvent) => {
        if (!canvasRef.current?.contains(e.target as Node)) return;
        e.preventDefault();

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));

        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;

          setPanOffset({
            x: mx - (mx - panOffset.x) * (newZoom / zoom),
            y: my - (my - panOffset.y) * (newZoom / zoom),
          });
        }

        setZoom(newZoom);
      },
      [zoom, panOffset]
    );

    useEffect(() => {
      const el = canvasRef.current;
      if (el && isFullscreenOpen) {
        el.addEventListener('wheel', handleWheelEvent, { passive: false });
        return () => el.removeEventListener('wheel', handleWheelEvent);
      }
    }, [isFullscreenOpen, handleWheelEvent]);

    // Zoom controls
    const handleZoomIn = () => setZoom((z) => Math.min(5, z * 1.2));
    const handleZoomOut = () => setZoom((z) => Math.max(0.1, z * 0.8));
    const handleResetView = () => {
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    };
    const handleFitToViewport = () => {
      setZoom(0.8);
      setPanOffset({ x: 0, y: 0 });
    };

    const handleFullscreenOpen = () => {
      if (!enableFullscreen) return;
      setIsFullscreenOpen(true);
      setZoom(0.8);
      setPanOffset({ x: 0, y: 0 });
      renderChartForFullscreen();
    };

    const renderChartForFullscreen = async () => {
      try {
        const cached = mermaidCache.get(chartHash);
        if (cached) {
          setFullscreenRenderedContent(cached);
          return;
        }

        if (!mermaidInstance) {
          const mermaid = (await import('mermaid')).default;
          await mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'base',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            gitGraph: {
              showBranches: true,
              showCommitLabel: true,
              mainBranchName: 'main',
              rotateCommitLabel: true,
            },
          });
          mermaidInstance = mermaid;
        }

        const id = `mfs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaidInstance.render(id, chart);
        mermaidCache.set(chartHash, svg);
        setFullscreenRenderedContent(svg);
      } catch (err) {
        console.error('Fullscreen render failed', err);
        setFullscreenRenderedContent(`
          <div style="display:flex;align-items:center;justify-content:center;height:200px;color:#6b7280;">
            <div style="text-align:center;">
              <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
              <div>Diagram rendering failed</div>
            </div>
          </div>
        `);
      }
    };

    // Keyboard shortcuts in fullscreen
    useEffect(() => {
      if (!isFullscreenOpen) return;

      const onKey = (e: KeyboardEvent) => {
        switch (e.key) {
          case 'Escape':
            setIsFullscreenOpen(false);
            break;
          case '+':
          case '=':
            e.preventDefault();
            handleZoomIn();
            break;
          case '-':
            e.preventDefault();
            handleZoomOut();
            break;
          case '0':
            e.preventDefault();
            handleResetView();
            break;
          case 'f':
          case 'F':
            e.preventDefault();
            handleFitToViewport();
            break;
        }
      };

      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [isFullscreenOpen]);

    // ────────────────────────────────────────────────
    //               Main render logic
    // ────────────────────────────────────────────────

    useEffect(() => {
      let mounted = true;

      const renderChart = async () => {
        if (!chart.trim()) {
          setIsLoading(false);
          return;
        }

        const cached = mermaidCache.get(chartHash);
        if (cached) {
          setRenderedContent(cached);
          setIsLoading(false);
          return;
        }

        try {
          setIsLoading(true);
          setError(null);

          if (!mermaidInstance) {
            const mermaid = (await import('mermaid')).default;
            await mermaid.initialize({
              startOnLoad: false,
              securityLevel: 'strict',
              theme: 'base',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              gitGraph: {
                showBranches: true,
                showCommitLabel: true,
                mainBranchName: 'main',
                rotateCommitLabel: true,
              },
            });
            mermaidInstance = mermaid;
          }

          const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
          const { svg } = await mermaidInstance.render(id, chart.trim());

          if (!mounted) return;

          mermaidCache.set(chartHash, svg);
          setRenderedContent(svg);
          setTimeout(cleanupMermaidErrors, 80);
        } catch (err: any) {
          console.error('Mermaid render error:', err);

          setTimeout(cleanupMermaidErrors, 50);

          const msg = err?.message || 'Unknown error';
          setError(msg);

          // 通知上層：渲染失敗 → 顯示原始碼
          onError?.();

          if (msg.includes('UnknownDiagramError') || msg.includes('No diagram type')) {
            setError('unsupported_diagram_type');
          }
        } finally {
          if (mounted) setIsLoading(false);
        }
      };

      renderChart();

      return () => {
        mounted = false;
      };
    }, [chartHash, onError]);

    if (isLoading) {
      return (
        <div className={cn('flex items-center justify-center p-8 bg-muted/30 rounded-2xl border border-dashed', className)}>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-3">Rendering diagram…</div>
            <KortixLoader size="medium" />
          </div>
        </div>
      );
    }

    if (error) {
      if (error === 'unsupported_diagram_type') {
        return (
          <div className={cn('my-2 text-xs text-muted-foreground', className)}>
            <div className="flex items-center gap-1.5 mb-1">
              <span>⚠️</span>
              <span>Unsupported diagram type in current Mermaid version</span>
            </div>
            <pre className="p-3 bg-muted/60 rounded-xl overflow-x-auto font-mono whitespace-pre-wrap text-[0.8rem] leading-relaxed">
              {chart}
            </pre>
          </div>
        );
      }

      return (
        <div className={cn('p-5 bg-destructive/5 border border-destructive/30 rounded-2xl', className)}>
          <div className="text-sm font-medium text-destructive mb-2">Diagram rendering failed</div>
          <div className="text-xs font-mono bg-muted/50 p-3 rounded border overflow-x-auto">
            {error}
          </div>
          <details className="mt-3">
            <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
              Show source
            </summary>
            <pre className="mt-2 p-3 bg-muted/60 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {chart}
            </pre>
          </details>
        </div>
      );
    }

    return (
      <>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .mermaid-container svg {
                max-width: 100% !important;
                height: auto !important;
                display: block !important;
                margin: 0 auto !important;
              }
              .mermaid-container text,
              .mermaid-container tspan {
                font-family: ui-sans-serif, system-ui, sans-serif !important;
                fill: hsl(var(--foreground)) !important;
              }
              .mermaid-container .node rect,
              .mermaid-container .node circle,
              .mermaid-container .node polygon,
              .mermaid-container .node ellipse {
                fill: hsl(var(--card)) !important;
                stroke: hsl(var(--border)) !important;
              }
              .mermaid-container .edgePath path {
                stroke: hsl(var(--foreground)) !important;
              }
              .mermaid-container .marker {
                fill: hsl(var(--foreground)) !important;
              }
            `,
          }}
        />

        <div
          className={cn(
            'mermaid-container rounded-2xl border bg-background/60 relative group cursor-pointer',
            enableFullscreen && 'hover:ring-1 hover:ring-primary/30 transition-all',
            className
          )}
          onClick={enableFullscreen ? handleFullscreenOpen : undefined}
        >
          <div ref={containerRef} dangerouslySetInnerHTML={{ __html: renderedContent }} />

          {enableFullscreen && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Button
                variant="secondary"
                size="icon"
                className="pointer-events-auto bg-background/90 shadow-sm border"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFullscreenOpen();
                }}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Fullscreen Dialog */}
        <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
          <DialogContent className="max-w-[96vw] max-h-[96vh] w-full h-full p-0 overflow-hidden bg-background">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-3 border-b bg-background/90 backdrop-blur-sm">
                <DialogTitle className="text-base">Mermaid Diagram</DialogTitle>
                <div className="flex items-center gap-2 mr-6">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleResetView}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleFitToViewport}>
                    Fit
                  </Button>
                </div>
              </div>

              <div
                ref={canvasRef}
                className="flex-1 relative overflow-hidden bg-muted/5 cursor-grab active:cursor-grabbing touch-none select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {fullscreenRenderedContent ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                      transformOrigin: 'center center',
                      transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                    }}
                    dangerouslySetInnerHTML={{ __html: fullscreenRenderedContent }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <KortixLoader size="medium" />
                  </div>
                )}

                <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-muted-foreground shadow-sm pointer-events-none">
                  Drag to pan • Wheel / Pinch to zoom • Esc to close
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

MermaidRenderer.displayName = 'MermaidRenderer';