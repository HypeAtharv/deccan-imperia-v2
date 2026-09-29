/* Deccan Imperia — Global Navigation, Mobile Menu & Brochure Download Handler */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initMobileDrawer();
    initDownloadTracking();
    initSolidBarOnSubpages();
  });

  function initNav() {
    // Highlight active link based on current path
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    $$(".nav a, .mobile-drawer-nav a").forEach(link => {
      const href = link.getAttribute("href");
      if (!href) return;
      const linkPath = href.split("#")[0].split("/").pop();
      if ((currentPath === "" || currentPath === "index.html") && (linkPath === "index.html" || linkPath === "" || href === "#top")) {
        link.classList.add("active");
      } else if (linkPath && currentPath === linkPath) {
        link.classList.add("active");
      }
    });
  }

  function initMobileDrawer() {
    const toggle = $(".nav-toggle");
    const drawer = $(".mobile-drawer");
    const backdrop = $(".mobile-drawer-backdrop");
    const closeBtn = $(".mobile-drawer-close");
    if (!toggle || !drawer) return;

    function openDrawer() {
      toggle.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      drawer.classList.add("open");
      if (backdrop) backdrop.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      drawer.classList.remove("open");
      if (backdrop) backdrop.classList.remove("open");
      document.body.style.overflow = "";
    }

    toggle.addEventListener("click", () => {
      const isOpen = drawer.classList.contains("open");
      if (isOpen) closeDrawer();
      else openDrawer();
    });

    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    if (backdrop) backdrop.addEventListener("click", closeDrawer);

    $$(".mobile-drawer-nav a, .mobile-drawer-actions a").forEach(link => {
      link.addEventListener("click", () => {
        closeDrawer();
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("open")) {
        closeDrawer();
      }
    });
  }

  function initDownloadTracking() {
    const downloadButtons = $$('.btn-download, a[download], [data-download-brochure]');
    
    downloadButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        showToast("Brochure Download Started", "Tathe Deshmukh Builders & Developer · Deccan Imperia Phase 1");
      });
    });
  }

  function showToast(title, subtitle) {
    let toast = $(".download-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "download-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div class="toast-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <div class="toast-content">
        <b>${title}</b>
        <span>${subtitle}</span>
      </div>
      <a class="toast-action" href="https://wa.me/919028561515?text=Hello%2C%20please%20send%20the%20Deccan%20Imperia%20brochure%20to%20my%20WhatsApp." target="_blank" rel="noopener">WhatsApp Copy</a>
      <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    toast.classList.add("show");

    const closeBtn = toast.querySelector(".toast-close");
    if (closeBtn) {
      closeBtn.onclick = () => toast.classList.remove("show");
    }

    setTimeout(() => {
      if (toast) toast.classList.remove("show");
    }, 6000);
  }

  function initSolidBarOnSubpages() {
    const bar = $(".bar");
    if (!bar) return;
    // If not on index with scroll scenes, keep bar solid or activate on light scroll
    const isIndex = !!$("#intro");
    if (!isIndex) {
      bar.classList.add("solid");
    }
  }

  window.__showBrochureToast = showToast;
})();
