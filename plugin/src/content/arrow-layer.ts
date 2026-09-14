// Viewport fixed SVG arrow connector between highlight text and answer cards
// Complies with 插件局部树执行计划 §3.5, §5 (LT08)

export interface ArrowConnection {
  id: string;
  source: HTMLElement | Range;
  target: HTMLElement;
  color?: string;
  isActive?: boolean;
}

export class ArrowLayer {
  public svg: SVGSVGElement;
  private defs: SVGDefsElement;
  private connections: ArrowConnection[] = [];
  private pathMap = new Map<string, SVGPathElement>();
  private rafId: number | null = null;
  private boundScheduleUpdate: () => void;
  private scrollContainers: HTMLElement[] = [];

  constructor() {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'zhihu-explore-arrow-layer');
    this.svg.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2147483646;
      display: none;
      overflow: visible;
    `;

    // Marker defs
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Inactive arrowhead
    const normalMarker = this.createMarker('zhihu-explore-arrow-head', '#94a3b8');
    this.defs.appendChild(normalMarker);

    // Active arrowhead
    const activeMarker = this.createMarker('zhihu-explore-arrow-head-active', '#0084ff');
    this.defs.appendChild(activeMarker);

    this.svg.appendChild(this.defs);
    document.body.appendChild(this.svg);

    this.boundScheduleUpdate = () => this.scheduleUpdate();
    window.addEventListener('resize', this.boundScheduleUpdate, { passive: true });
    window.addEventListener('scroll', this.boundScheduleUpdate, { passive: true });
  }

  private createMarker(id: string, color: string): SVGMarkerElement {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '5');
    marker.setAttribute('markerHeight', '5');
    marker.setAttribute('orient', 'auto-start-reverse');

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    polygon.setAttribute('d', 'M 0 1.5 L 8 5 L 0 8.5 z');
    polygon.setAttribute('fill', color);
    marker.appendChild(polygon);
    return marker;
  }

  registerScrollContainer(container: HTMLElement) {
    if (!this.scrollContainers.includes(container)) {
      this.scrollContainers.push(container);
      container.addEventListener('scroll', this.boundScheduleUpdate, { passive: true });
    }
  }

  unregisterScrollContainer(container: HTMLElement) {
    const idx = this.scrollContainers.indexOf(container);
    if (idx !== -1) {
      this.scrollContainers.splice(idx, 1);
      container.removeEventListener('scroll', this.boundScheduleUpdate);
    }
  }

  /**
   * Sets all active arrow connections (multiple branching arrows).
   */
  setConnections(connections: ArrowConnection[]) {
    this.connections = connections;

    // Prune removed connections
    const nextIds = new Set(connections.map((c) => c.id));
    for (const [id, pathEl] of this.pathMap.entries()) {
      if (!nextIds.has(id)) {
        pathEl.remove();
        this.pathMap.delete(id);
      }
    }

    // Ensure path element exists for each connection
    for (const conn of connections) {
      if (!this.pathMap.has(conn.id)) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', '1.5');
        // Fine solid line, no dasharray (§3.5)
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke', conn.isActive ? (conn.color || '#0084ff') : '#94a3b8');
        path.setAttribute('opacity', conn.isActive ? '1.0' : '0.5');
        this.svg.appendChild(path);
        this.pathMap.set(conn.id, path);
      }
    }

    if (connections.length > 0) {
      this.svg.style.display = 'block';
      this.updatePositions();
      this.scheduleUpdate();
    } else {
      this.svg.style.display = 'none';
    }
  }

  /**
   * Backwards compatible single connection helper.
   */
  connect(source: HTMLElement | Range, target: HTMLElement, color = '#0084ff') {
    this.setConnections([
      {
        id: 'default',
        source,
        target,
        color,
        isActive: true,
      },
    ]);
  }

  clear() {
    this.connections = [];
    for (const path of this.pathMap.values()) {
      path.remove();
    }
    this.pathMap.clear();
    this.svg.style.display = 'none';
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private scheduleUpdate() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updatePositions();
    });
  }

  private isElementVisible(el: HTMLElement, rect: DOMRect): boolean {
    if (rect.width === 0 && rect.height === 0) return false;

    // Viewport bounds
    const inViewport = (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
    if (!inViewport) return false;

    // Check ancestors scroll clipping
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'hidden') {
        const parentRect = parent.getBoundingClientRect();
        if (rect.bottom < parentRect.top || rect.top > parentRect.bottom) {
          return false;
        }
      }
      parent = parent.parentElement;
    }

    return true;
  }

  private isRangeVisible(range: Range, rect: DOMRect): boolean {
    if (rect.width === 0 && rect.height === 0) return false;
    const inViewport = (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
    if (!inViewport) return false;

    const container = range.commonAncestorContainer;
    let el = container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'hidden') {
        const parentRect = el.getBoundingClientRect();
        if (rect.bottom < parentRect.top || rect.top > parentRect.bottom) {
          return false;
        }
      }
      el = el.parentElement;
    }
    return true;
  }

  private updatePositions() {
    if (this.connections.length === 0) {
      this.svg.style.display = 'none';
      return;
    }

    let hasAnyVisible = false;

    for (const conn of this.connections) {
      const path = this.pathMap.get(conn.id);
      if (!path) continue;

      const isRange = conn.source instanceof Range;
      const sourceConnected = isRange
        ? (conn.source as Range).commonAncestorContainer.isConnected
        : document.body.contains(conn.source as HTMLElement);
      const targetConnected = document.body.contains(conn.target);

      if (!sourceConnected || !targetConnected) {
        path.setAttribute('d', '');
        continue;
      }

      const sourceRect = conn.source.getBoundingClientRect();
      const targetRect = conn.target.getBoundingClientRect();

      const sourceVisible = isRange
        ? this.isRangeVisible(conn.source as Range, sourceRect)
        : this.isElementVisible(conn.source as HTMLElement, sourceRect);
      const targetVisible = this.isElementVisible(conn.target, targetRect);

      const color = conn.isActive ? (conn.color || '#0084ff') : '#94a3b8';
      path.setAttribute('stroke', color);
      path.setAttribute('opacity', conn.isActive ? '1.0' : '0.5');
      path.setAttribute(
        'marker-end',
        conn.isActive ? 'url(#zhihu-explore-arrow-head-active)' : 'url(#zhihu-explore-arrow-head)'
      );

      if (!sourceVisible || !targetVisible) {
        path.setAttribute('d', '');
        continue;
      }

      // Determine source endpoint from right edge of highlight line
      const clientRects = conn.source.getClientRects();
      const lastRect = clientRects.length > 0 ? clientRects[clientRects.length - 1]! : sourceRect;
      const startX = lastRect.right;
      const startY = lastRect.top + lastRect.height / 2;

      // Determine target endpoint at entrance of answer card
      const endX = targetRect.left;
      const endY = targetRect.top + Math.min(24, targetRect.height / 2);

      // Fine solid straight or orthogonal polyline (§3.5)
      let d = '';
      if (endX > startX + 16) {
        // Orthogonal elbow polyline
        const midX = Math.round((startX + endX) / 2);
        d = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
      } else {
        // Source is to the right of target or very close
        const outX = startX + 12;
        d = `M ${startX} ${startY} L ${outX} ${startY} L ${outX} ${endY} L ${endX} ${endY}`;
      }

      path.setAttribute('d', d);
      hasAnyVisible = true;
    }

    this.svg.style.display = hasAnyVisible ? 'block' : 'none';
  }

  destroy() {
    this.clear();
    window.removeEventListener('resize', this.boundScheduleUpdate);
    window.removeEventListener('scroll', this.boundScheduleUpdate);
    for (const c of this.scrollContainers) {
      c.removeEventListener('scroll', this.boundScheduleUpdate);
    }
    this.scrollContainers = [];
    this.svg.remove();
  }
}
