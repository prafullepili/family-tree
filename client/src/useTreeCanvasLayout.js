import { useMemo, useRef } from 'react';
import { layoutTree } from './layoutTree.js';

export default function useTreeCanvasLayout({ treePeople, isCompactViewport, phoneLayoutPreview, treeViewportWidth, treeViewportHeight, zoom }) {
  const layoutPeople = useMemo(() => {
    if (!isCompactViewport || !Object.keys(phoneLayoutPreview).length) return treePeople;
    return treePeople.map((person) => {
      const preview = phoneLayoutPreview[person.id];
      return preview ? { ...person, treeX: preview.treeX, treeY: preview.treeY } : person;
    });
  }, [treePeople, isCompactViewport, phoneLayoutPreview]);
  const cardWidth = 196;
  const cardHeight = 76;
  const layout = useMemo(() => layoutTree(layoutPeople, { nodeWidth: cardWidth, nodeHeight: cardHeight }), [layoutPeople, cardWidth, cardHeight]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const layoutPositions = [...layout.positions.values()];
  const minNodeX = layoutPositions.length ? Math.min(...layoutPositions.map((position) => position.x)) : 0;
  const minNodeY = layoutPositions.length ? Math.min(...layoutPositions.map((position) => position.y)) : 0;
  const maxNodeX = layoutPositions.length ? Math.max(...layoutPositions.map((position) => position.x + position.w)) : layout.width;
  const maxNodeY = layoutPositions.length ? Math.max(...layoutPositions.map((position) => position.y + position.h)) : layout.height;
  const treeBaseWidth = Math.max(800, ...layoutPositions.map((position) => position.automaticX + layout.originX + position.w + 60));
  const treeBaseHeight = Math.max(300, ...layoutPositions.map((position) => position.automaticY + layout.originY + position.h + 100));
  // Manual dragging can put nodes above/left of the automatic layout's origin.
  // Add canvas space for those coordinates so zooming never clips a moved node.
  const treeBoardOffsetX = Math.max(0, 60 - minNodeX);
  const treeBoardOffsetY = Math.max(0, 56 - minNodeY);
  const treePaddingX = treeViewportWidth / 2;
  const treePaddingY = treeViewportHeight / 2;
  const maxCanvasZoom = Math.max(0.1, Math.min(2, (treeViewportWidth - 24) / cardWidth));
  const treeBoardWidth = Math.max(layout.width, maxNodeX) + treeBoardOffsetX;
  const treeBoardHeight = Math.max(layout.height, maxNodeY) + treeBoardOffsetY;
  const treeContentWidth = treeBoardWidth * zoom;
  // Keep the automatic layout's origin fixed as manually moved nodes expand
  // the canvas. Scroll padding cancels the changing origin so dragging keeps
  // tracking the pointer at every edge.
  const treeBoardLeft = treePaddingX + treeBoardOffsetX * zoom + Math.max(0, (treeViewportWidth - treeBaseWidth * zoom) / 2);
  const treeBoardTop = treePaddingY + treeBoardOffsetY * zoom + Math.max(0, (treeViewportHeight - treeBaseHeight * zoom) / 2);
  const treeExtraWidth = Math.max(0, (layout.originX - 60 + treeBoardOffsetX) * zoom, treePaddingX * 2 + treeBoardLeft + treeContentWidth - treeViewportWidth);
  const appliedTreeOffset = useRef({ x: treeBoardOffsetX, y: treeBoardOffsetY });
  const connectorNodePositions = [...layout.positions.values()];
  const connectorLabelPositions = [];
  return {
    layoutPeople,
    cardWidth,
    cardHeight,
    layout,
    layoutRef,
    layoutPositions,
    minNodeX,
    minNodeY,
    maxNodeX,
    maxNodeY,
    treeBoardOffsetX,
    treeBoardOffsetY,
    treePaddingX,
    treePaddingY,
    maxCanvasZoom,
    treeBoardWidth,
    treeBoardHeight,
    treeContentWidth,
    treeBoardLeft,
    treeBoardTop,
    treeExtraWidth,
    appliedTreeOffset,
    connectorNodePositions,
    connectorLabelPositions,
  };
}

