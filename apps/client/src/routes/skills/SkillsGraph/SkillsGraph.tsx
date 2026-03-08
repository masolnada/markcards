import { useRef, useEffect } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import type { DeckSummary } from '@markcards/types';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  radius: number;
  kind: 'root' | 'deck' | 'folder';
  deckSummary?: DeckSummary;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

function getDeckColor(deck: DeckSummary, el: Element): string {
  const style = getComputedStyle(el);
  const reviewed = deck.stats.total - deck.stats.newCards;
  if (reviewed === 0) {
    return style.getPropertyValue('--color-muted-foreground').trim() || '#888';
  }
  if (deck.stats.shortReview / reviewed > 0.5) {
    return style.getPropertyValue('--color-danger').trim() || '#ef4444';
  }
  if (deck.stats.relearning / reviewed > 0.1) {
    return style.getPropertyValue('--color-warning').trim() || '#f59e0b';
  }
  return style.getPropertyValue('--color-success').trim() || '#22c55e';
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
}

export function SkillsGraph({ decks }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clear previous render
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 600;

    const NS = 'http://www.w3.org/2000/svg';
    const style = getComputedStyle(svg);
    const borderColor = style.getPropertyValue('--color-border').trim() || '#e5e7eb';
    const mutedFg = style.getPropertyValue('--color-muted-foreground').trim() || '#888';
    const fgColor = style.getPropertyValue('--color-foreground').trim() || '#111';

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
      kind: 'root',
      fx: width / 2,
      fy: height / 2,
    });

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

    // Initialize positions randomly around center
    for (const n of nodes) {
      n.x = width / 2 + (Math.random() - 0.5) * 200;
      n.y = height / 2 + (Math.random() - 0.5) * 200;
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
      line.setAttribute('stroke', borderColor);
      line.setAttribute('stroke-width', '1');
      linkGroup.appendChild(line);
      return line;
    });

    // Create node elements
    const nodeEls: SVGCircleElement[] = nodes.map(n => {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('r', String(n.radius));
      if (n.kind === 'deck' && n.deckSummary) {
        circle.setAttribute('fill', getDeckColor(n.deckSummary, svg));
      } else if (n.kind === 'root') {
        circle.setAttribute('fill', fgColor);
        circle.setAttribute('opacity', '0.15');
      } else {
        circle.setAttribute('fill', mutedFg);
        circle.setAttribute('opacity', '0.4');
      }
      circle.setAttribute('cursor', n.kind === 'root' ? 'default' : 'grab');
      nodeGroup.appendChild(circle);
      return circle;
    });

    // Create label elements (deck and folder nodes)
    const labelEls: (SVGTextElement | null)[] = nodes.map(n => {
      if (n.kind === 'root' || !n.label) return null;
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('font-size', n.kind === 'folder' ? '11' : '10');
      text.setAttribute('font-weight', n.kind === 'folder' ? '600' : '400');
      text.setAttribute('fill', fgColor);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', String(n.radius + 12));
      text.setAttribute('pointer-events', 'none');
      text.textContent = n.label;
      labelGroup.appendChild(text);
      return text;
    });

    // Simulation
    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(60))
      .force('charge', forceManyBody<GraphNode>().strength(-120))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<GraphNode>(n => n.radius + 4));

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

    function getPos(e: PointerEvent): { x: number; y: number } {
      const rect = svg.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    nodeEls.forEach((circle, i) => {
      const node = nodes[i];
      if (node.kind === 'root') return;
      circle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        dragging = node;
        dragging.fx = dragging.x;
        dragging.fy = dragging.y;
        circle.setAttribute('cursor', 'grabbing');
        circle.setPointerCapture(e.pointerId);
        sim.alphaTarget(0.3).restart();
      });
      circle.addEventListener('pointermove', (e: PointerEvent) => {
        if (dragging !== node) return;
        const pos = getPos(e);
        dragging.fx = pos.x;
        dragging.fy = pos.y;
      });
      circle.addEventListener('pointerup', () => {
        if (dragging !== node) return;
        dragging.fx = null;
        dragging.fy = null;
        dragging = null;
        circle.setAttribute('cursor', 'grab');
        sim.alphaTarget(0);
      });
    });

    return () => {
      sim.stop();
    };
  }, [decks]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-surface"
    />
  );
}
