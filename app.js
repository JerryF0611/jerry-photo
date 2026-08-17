/* =============================================
   JerryPhoto | Elite UI Application Logic
   ============================================= */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────
  const PANO_MAP = {
    'scene_ahuacatlan': 'ahuacatlan.jpg',
    'scene_barranca_de_oro': 'barranca-de-oro.jpg'
  };

  const els = {
    loader: document.getElementById('loader'),
    loaderProgress: document.querySelector('.loader-progress'),
    panoramaWrapper: document.querySelector('.panorama-container'),
    panoramaOverlay: document.querySelector('.panorama-overlay'),
    sceneList: document.getElementById('scene-list'),
    currentSceneName: document.getElementById('current-scene-name'),
    cursor: document.querySelector('.cursor')
  };

  let viewer = null;
  let projectData = null;

  // ── 1. Data Loading ─────────────────────────
  async function loadConfig() {
    try {
      const res = await fetch('db.json?v=' + new Date().getTime());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('Error loading db.json', e);
      return null;
    }
  }

  // ── 2. Initialize Lenis (Smooth Scroll) ───
  function initLenis() {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo out
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Integrate GSAP with Lenis
    if (window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time)=>{
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0, 0);
    }
  }

  // ── 3. Initialize GSAP Animations ─────────
  function initAnimations() {
    // Intro Loader Animation
    gsap.to(els.loaderProgress, { width: '100%', duration: 0.8, ease: 'power2.inOut' });
    gsap.to('.loader-title', { opacity: 1, y: 0, duration: 0.6, delay: 0.2, ease: 'power3.out' });
    
    gsap.to(els.loader, {
      yPercent: -100,
      duration: 1.2,
      delay: 1,
      ease: 'expo.inOut',
      onComplete: () => {
        els.loader.style.display = 'none';
        document.body.classList.remove('loading');
        animateHero();
      }
    });

    // Showcase ScrollTrigger
    gsap.to(els.panoramaWrapper, {
      scrollTrigger: {
        trigger: '.showcase-section',
        start: 'top 80%',
        end: 'top 20%',
        scrub: 1
      },
      scale: 1,
      opacity: 1,
      ease: 'power2.out'
    });
  }

  function animateHero() {
    gsap.fromTo('.hero-title .line', 
      { y: '100%' },
      { y: '0%', duration: 1.2, stagger: 0.1, ease: 'expo.out' }
    );
    gsap.fromTo('.hero-subtitle', 
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1, delay: 0.4, ease: 'power3.out' }
    );
  }

  // ── 4. Initialize Custom Cursor & Magnet ──
  function initCursor() {
    if (window.innerWidth < 768) return; // Disable on mobile

    document.addEventListener('mousemove', (e) => {
      gsap.to(els.cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
        ease: 'power2.out'
      });
    });

    // Magnetic buttons
    const magneticBtns = document.querySelectorAll('.magnetic-btn');
    magneticBtns.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const strength = btn.dataset.strength || 20;
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * strength;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * strength;
        
        gsap.to(btn, { x: x, y: y, duration: 0.3, ease: 'power2.out' });
        els.cursor.classList.add('active');
      });

      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.3)' });
        els.cursor.classList.remove('active');
      });
    });

    // Interactive regions
    const interactiveEls = document.querySelectorAll('.accordion-item, .panorama-container');
    interactiveEls.forEach(el => {
      el.addEventListener('mouseenter', () => els.cursor.classList.add('active'));
      el.addEventListener('mouseleave', () => els.cursor.classList.remove('active'));
    });
  }

  // ── 5. Initialize Pannellum ───────────────
  function initViewer(data) {
    const scenes = {};
    let firstSceneId = null;

    data.scenes.forEach(scene => {
      const panoramaFile = PANO_MAP[scene._id];
      if (!panoramaFile) return;

      if (!firstSceneId) firstSceneId = scene._id;

      scenes[scene._id] = {
        title: scene.title,
        type: 'equirectangular',
        panorama: panoramaFile,
        pitch: scene.default_view.vlookat || 0,
        yaw: scene.default_view.hlookat || 0,
        hfov: scene.default_view.fov || 90,
        autoRotate: -1.5,
        autoRotateInactivityDelay: 4000
      };
    });

    viewer = pannellum.viewer('panorama', {
      default: {
        firstScene: firstSceneId,
        autoLoad: true,
        sceneFadeDuration: 1000,
        showControls: false,
        mouseZoom: true
      },
      scenes: scenes
    });

    // Update scene name on change
    viewer.on('scenechange', (sceneId) => {
      const scene = data.scenes.find(s => s._id === sceneId);
      if (scene) els.currentSceneName.textContent = scene.title;
    });

    // Initial scene name
    const initialScene = data.scenes.find(s => s._id === firstSceneId);
    if (initialScene) els.currentSceneName.textContent = initialScene.title;

    // Remove overlay on interaction
    els.panoramaWrapper.addEventListener('mousedown', () => {
      els.panoramaOverlay.classList.add('hidden');
    });
  }

  // ── 6. Build Accordion Cards ──────────────
  function buildAccordion(data) {
    els.sceneList.innerHTML = '';
    
    data.scenes.forEach((scene, i) => {
      if (!PANO_MAP[scene._id]) return;

      const btn = document.createElement('button');
      btn.className = i === 0 ? 'accordion-item active' : 'accordion-item';
      
      // Inline style for background image
      const bgUrl = PANO_MAP[scene._id];
      btn.style.setProperty('--bg-image', `url('${bgUrl}')`);

      btn.innerHTML = `
        <div class="accordion-content">
          <h3 class="accordion-title">${scene.title}</h3>
          <span class="accordion-meta">Explorar en 360°</span>
        </div>
      `;

      btn.addEventListener('click', () => {
        // Remove active class from all
        document.querySelectorAll('.accordion-item').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        
        // Load scene in viewer
        if(viewer) viewer.loadScene(scene._id);
        
        // Smooth scroll back to showcase
        const lenis = window.Lenis; // Wait, we didn't export lenis globally. Let's just use native scroll or GSAP
        document.getElementById('showcase').scrollIntoView({ behavior: 'smooth' });
      });

      els.sceneList.appendChild(btn);
    });
  }

  // ── Main Init ──────────────────────────────
  async function init() {
    initLenis();
    initCursor();
    
    projectData = await loadConfig();
    if (projectData) {
      buildAccordion(projectData);
      initViewer(projectData);
    } else {
      els.currentSceneName.textContent = 'Error cargando datos';
    }

    initAnimations();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
