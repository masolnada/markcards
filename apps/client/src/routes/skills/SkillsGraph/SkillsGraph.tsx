import { useRef, useEffect } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceRadial,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import type { DeckSummary } from '@markcards/types';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  radius: number;
  depth: number;
  kind: 'root' | 'deck' | 'folder' | 'suspended';
  deckSummary?: DeckSummary;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

function getDeckColorVar(deck: DeckSummary): string {
  const reviewed = deck.stats.total - deck.stats.newCards;
  if (reviewed === 0) return 'var(--color-muted-foreground)';
  if (deck.stats.shortReview / reviewed > 0.5) return 'var(--color-danger)';
  if (deck.stats.relearning / reviewed > 0.1) return 'var(--color-warning)';
  return 'var(--color-success)';
}

function stripCommonPrefix(paths: string[]): string[] {
  if (paths.length === 0) return paths;
  const parts = paths.map(p => p.split('/'));
  const minLen = Math.min(...parts.map(p => p.length));
  let prefixLen = 0;
  for (let i = 0; i < minLen - 1; i++) {
    if (parts.every(p => p[i] === parts[0][i])) prefixLen = i + 1;
    else break;
  }
  return paths.map(p => p.split('/').slice(prefixLen).join('/'));
}

interface Props {
  decks: DeckSummary[];
  suspendedCount: number;
  onDeckClick?: (deck: DeckSummary) => void;
  onBackgroundClick?: () => void;
  onSuspendedClick?: () => void;
}

export function SkillsGraph({ decks, suspendedCount, onDeckClick, onBackgroundClick, onSuspendedClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clear previous render
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 600;

    const NS = 'http://www.w3.org/2000/svg';

    // Build relative paths
    const rawPaths = decks.map(d => d.filePath.replace(/\.md$/i, ''));
    const relPaths = stripCommonPrefix(rawPaths);

    // Build nodes and links
    const ROOT_ID = '__root__';
    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    // Root node — pinned at center
    nodeMap.set(ROOT_ID, {
      id: ROOT_ID,
      label: '',
      radius: 10,
      depth: 0,
      kind: 'root',
      fx: width / 2,
      fy: height / 2,
      x: width / 2,
      y: height / 2,
    });

    // Suspended node
    const SUSPENDED_ID = '__suspended__';
    nodeMap.set(SUSPENDED_ID, {
      id: SUSPENDED_ID,
      label: suspendedCount > 0 ? `suspended (${suspendedCount})` : 'suspended',
      radius: 8,
      depth: 1,
      kind: 'suspended',
    });
    links.push({ source: SUSPENDED_ID, target: ROOT_ID });

    // Folder nodes
    const folderSet = new Set<string>();
    for (const rel of relPaths) {
      const parts = rel.split('/');
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        folderSet.add(folderPath);
      }
    }
    for (const folder of folderSet) {
      nodeMap.set(folder, {
        id: folder,
        label: folder.split('/').pop() ?? folder,
        radius: 8,
        depth: folder.split('/').length,
        kind: 'folder',
      });
    }

    // Deck nodes + links
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i];
      const rel = relPaths[i];
      const parts = rel.split('/');
      const deckId = rel;
      const radius = Math.min(30, Math.max(8, Math.sqrt(deck.stats.total) * 3));
      nodeMap.set(deckId, {
        id: deckId,
        label: parts[parts.length - 1],
        radius,
        depth: parts.length,
        kind: 'deck',
        deckSummary: deck,
      });

      if (parts.length > 1) {
        // Deck → its parent folder
        const parentFolder = parts.slice(0, -1).join('/');
        links.push({ source: deckId, target: parentFolder });
      } else {
        // Root-level deck → root
        links.push({ source: deckId, target: ROOT_ID });
      }
    }

    // Folder hierarchy links
    for (const folder of folderSet) {
      const parts = folder.split('/');
      if (parts.length > 1) {
        // Sub-folder → parent folder
        const parentFolder = parts.slice(0, -1).join('/');
        if (nodeMap.has(parentFolder)) {
          links.push({ source: folder, target: parentFolder });
        }
      } else {
        // Top-level folder → root
        links.push({ source: folder, target: ROOT_ID });
      }
    }

    const nodes: GraphNode[] = Array.from(nodeMap.values());

    const maxDepth = Math.max(...nodes.map(n => n.depth), 1);
    const ringSpacing = Math.min(width, height) * 0.42 / maxDepth;

    // Pre-position nodes on their target rings, evenly spread by angle
    const depthCounters = new Map<number, number>();
    const depthTotals = new Map<number, number>();
    for (const n of nodes) depthTotals.set(n.depth, (depthTotals.get(n.depth) ?? 0) + 1);
    for (const n of nodes) {
      if (n.kind === 'root') continue;
      const count = depthTotals.get(n.depth) ?? 1;
      const idx = depthCounters.get(n.depth) ?? 0;
      depthCounters.set(n.depth, idx + 1);
      const angle = (idx / count) * 2 * Math.PI;
      const r = n.depth * ringSpacing;
      n.x = width / 2 + r * Math.cos(angle);
      n.y = height / 2 + r * Math.sin(angle);
    }

    // SVG groups
    const linkGroup = document.createElementNS(NS, 'g');
    const nodeGroup = document.createElementNS(NS, 'g');
    const labelGroup = document.createElementNS(NS, 'g');
    svg.appendChild(linkGroup);
    svg.appendChild(nodeGroup);
    svg.appendChild(labelGroup);

    // Create link elements
    const linkEls: SVGLineElement[] = links.map(() => {
      const line = document.createElementNS(NS, 'line');
      line.style.stroke = 'var(--color-border)';
      line.setAttribute('stroke-width', '1');
      linkGroup.appendChild(line);
      return line;
    });

    // Create node elements
    const nodeEls: SVGCircleElement[] = nodes.map(n => {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('r', String(n.radius));
      if (n.kind === 'deck' && n.deckSummary) {
        circle.style.fill = getDeckColorVar(n.deckSummary);
      } else if (n.kind === 'root') {
        circle.style.fill = 'var(--color-foreground)';
        circle.setAttribute('opacity', '0.15');
      } else if (n.kind === 'suspended') {
        if (suspendedCount > 0) {
          circle.style.fill = 'var(--color-warning)';
        } else {
          circle.style.fill = 'var(--color-muted-foreground)';
          circle.setAttribute('opacity', '0.4');
        }
      } else {
        circle.style.fill = 'var(--color-muted-foreground)';
        circle.setAttribute('opacity', '0.4');
      }
      circle.setAttribute('cursor', n.kind === 'root' ? 'default' : (onDeckClick && n.kind === 'deck' ? 'pointer' : (onSuspendedClick && n.kind === 'suspended' ? 'pointer' : 'grab')));
      nodeGroup.appendChild(circle);
      return circle;
    });

    // Create label elements (deck and folder nodes)
    const labelEls: (SVGTextElement | null)[] = nodes.map(n => {
      if (n.kind === 'root' || !n.label) return null;
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('font-size', n.kind === 'folder' ? '11' : '10');
      text.setAttribute('font-weight', n.kind === 'folder' ? '600' : '400');
      text.style.fill = 'var(--color-foreground)';
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', String(n.radius + 12));
      if (n.kind === 'deck' && onDeckClick && n.deckSummary) {
        text.setAttribute('cursor', 'pointer');
        text.addEventListener('click', () => onDeckClick(n.deckSummary!));
      } else if (n.kind === 'suspended' && onSuspendedClick) {
        text.setAttribute('cursor', 'pointer');
        text.addEventListener('click', () => onSuspendedClick());
      } else {
        text.setAttribute('pointer-events', 'none');
      }
      text.textContent = n.label;
      labelGroup.appendChild(text);
      return text;
    });

    // Simulation
    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(ringSpacing * 0.9).strength(0.8))
      .force('charge', forceManyBody<GraphNode>().strength(-300))
      .force('radial', forceRadial<GraphNode>(n => n.depth * ringSpacing, width / 2, height / 2).strength(0.9))
      .force('collide', forceCollide<GraphNode>(n => n.radius + 6));

    sim.on('tick', () => {
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
        const s = l.source as GraphNode;
        const t = l.target as GraphNode;
        linkEls[i].setAttribute('x1', String(s.x ?? 0));
        linkEls[i].setAttribute('y1', String(s.y ?? 0));
        linkEls[i].setAttribute('x2', String(t.x ?? 0));
        linkEls[i].setAttribute('y2', String(t.y ?? 0));
      }
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        nodeEls[i].setAttribute('cx', String(n.x ?? 0));
        nodeEls[i].setAttribute('cy', String(n.y ?? 0));
        const lbl = labelEls[i];
        if (lbl) {
          lbl.setAttribute('x', String(n.x ?? 0));
          lbl.setAttribute('y', String(n.y ?? 0));
        }
      }
    });

    // Drag support
    let dragging: GraphNode | null = null;
    let dragStartPos: { x: number; y: number } | null = null;

    function getPos(e: PointerEvent): { x: number; y: number } {
      const rect = svg!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    nodeEls.forEach((circle, i) => {
      const node = nodes[i];
      if (node.kind === 'root') return;
      circle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        dragging = node;
        dragStartPos = getPos(e);
        dragging.fx = dragging.x;
        dragging.fy = dragging.y;
        if (!(onDeckClick && node.kind === 'deck') && !(onSuspendedClick && node.kind === 'suspended')) {
          circle.setAttribute('cursor', 'grabbing');
        }
        circle.setPointerCapture(e.pointerId);
        sim.alphaTarget(0.3).restart();
      });
      circle.addEventListener('pointermove', (e: PointerEvent) => {
        if (dragging !== node) return;
        const pos = getPos(e);
        dragging.fx = pos.x;
        dragging.fy = pos.y;
      });
      circle.addEventListener('pointerup', (e: PointerEvent) => {
        if (dragging !== node) return;
        const endPos = getPos(e);
        const dx = endPos.x - (dragStartPos?.x ?? endPos.x);
        const dy = endPos.y - (dragStartPos?.y ?? endPos.y);
        const dist = Math.sqrt(dx * dx + dy * dy);
        dragging.fx = null;
        dragging.fy = null;
        dragging = null;
        dragStartPos = null;
        if (!(onDeckClick && node.kind === 'deck') && !(onSuspendedClick && node.kind === 'suspended')) {
          circle.setAttribute('cursor', 'grab');
        }
        sim.alphaTarget(0);
        if (dist < 5 && onDeckClick && node.kind === 'deck' && node.deckSummary) {
          onDeckClick(node.deckSummary);
        } else if (dist < 5 && onSuspendedClick && node.kind === 'suspended') {
          onSuspendedClick();
        }
      });
    });

    // Close panel when clicking SVG background (not a node)
    const handleSvgClick = (e: MouseEvent) => {
      if (e.target === svg) onBackgroundClick?.();
    };
    svg.addEventListener('click', handleSvgClick);

    return () => {
      sim.stop();
      svg.removeEventListener('click', handleSvgClick);
    };
  }, [decks, suspendedCount, onDeckClick, onBackgroundClick, onSuspendedClick]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-surface"
    />
  );
}
