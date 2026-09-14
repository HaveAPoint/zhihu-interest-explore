// Non-intrusive host layout and drawer accommodation manager
// Complies with 插件局部树执行计划 §3.7, §5 (LT10)

export class HostLayoutManager {
  private originalMarginRight: string | null = null;
  private originalTransition: string | null = null;
  private isShifted: boolean = false;

  /**
   * Shifts host content to the left when drawer opens on large screens (>1400px).
   * Saves original inline styles to allow 100% faithful restoration.
   */
  shiftHost(drawerWidth: number) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (window.innerWidth <= 1400) {
      // Small/medium screens: direct float overlay, do not compress Zhihu reading width (§3.7)
      this.restoreHost();
      return;
    }

    if (!this.isShifted) {
      this.originalMarginRight = document.body.style.marginRight || null;
      this.originalTransition = document.body.style.transition || null;
      this.isShifted = true;
    }

    document.body.style.transition = 'margin-right 0.25s ease';
    document.body.style.marginRight = `${drawerWidth}px`;
  }

  /**
   * Restores host inline styles faithfully:
   * Uses removeProperty if the property was originally empty, avoiding lingering '0px'.
   */
  restoreHost() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!this.isShifted) return;

    if (this.originalMarginRight !== null) {
      document.body.style.marginRight = this.originalMarginRight;
    } else {
      document.body.style.removeProperty('margin-right');
    }

    if (this.originalTransition !== null) {
      document.body.style.transition = this.originalTransition;
    } else {
      document.body.style.removeProperty('transition');
    }

    this.isShifted = false;
  }
}
