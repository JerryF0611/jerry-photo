/* =============================================
   Directorio 360° — Ahuacatlán
   Application Logic
   ============================================= */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────
  // Maps scene IDs from db.json to local panorama files.
  // Add entries here when new panorama images are available.
  const PANO_MAP = {
    '6a7e39ed3bb05556950105fe': 'recorrido_taller.jpg',
    'scene_ahuacatlan': 'ahuacatlan.jpg'
  };

  // ── DOM References ─────────────────────────
  const $ = (id) => document.getElementById(id);
  const els = {
    panorama:     $('panorama'),
    sidebar:      $('sidebar'),
    toggle:       $('sidebar-toggle'),
    sceneList:    $('scene-list'),
    popup:        $('hotspot-popup'),
    popupTitle:   $('popup-title'),
    popupBody:    $('popup-body'),
    popupClose:   $('popup-close'),
    sceneName:    $('current-scene-name'),
    hotspotCount: $('hotspot-count'),
    loader:       $('loader'),
  };

  // ── State ──────────────────────────────────
  let viewer = null;
  let projectData = null;
  let sidebarOpen = false;

  async function loadConfig() {
    // Se agrega una marca de tiempo para evitar el caché agresivo del navegador
    const res = await fetch('db.json?v=' + new Date().getTime());
    if (!res.ok) throw new Error(`HTTP ${res.status}: No se pudo cargar db.json`);
    return res.json();
  }

  // ── Hotspot Click Handler ──────────────────
  function handleHotspotClick(event, args) {
    if (event) event.stopPropagation();
    els.popupTitle.textContent = args.title || '';
    els.popupBody.innerHTML = args.content || '<p>Sin información adicional.</p>';
    els.popup.classList.add('visible');
  }

  function hidePopup() {
    els.popup.classList.remove('visible');
  }

  // ── Build Pannellum Configuration ──────────
  function buildViewerConfig(data) {
    const scenes = {};
    let firstSceneId = null;

    data.scenes.forEach(function (scene) {
      const panoramaFile = PANO_MAP[scene._id];
      if (!panoramaFile) return; // skip scenes without a local panorama

      if (!firstSceneId) firstSceneId = scene._id;

      const hotSpots = (scene.hotspots || []).map(function (hs) {
        return {
          pitch:            hs.position.y,
          yaw:              hs.position.x,
          type:             'info',
          text:             hs.title,
          clickHandlerFunc: handleHotspotClick,
          clickHandlerArgs: {
            title:   hs.title,
            content: hs.content,
          },
        };
      });

      scenes[scene._id] = {
        title:    scene.title,
        type:     'equirectangular',
        panorama: panoramaFile,
        pitch:    scene.default_view.vlookat,
        yaw:      scene.default_view.hlookat,
        hfov:     scene.default_view.fov,
        minHfov:  scene.min_zoom || 40,
        maxHfov:  scene.max_zoom || 120,
        autoRotate: -1.5,
        autoRotateInactivityDelay: 8000,
        hotSpots: hotSpots,
      };
    });

    if (!firstSceneId) {
      throw new Error('No se encontraron escenas con panoramas disponibles.');
    }

    return {
      default: {
        firstScene:       firstSceneId,
        autoLoad:         true,
        sceneFadeDuration: 800,
        compass:          false,
        showControls:     true,
        mouseZoom:        true,
        keyboardZoom:     true,
        friction:         0.12,
        draggable:        true,
        disableKeyboardCtrl: false,
        showFullscreenCtrl:  true,
      },
      scenes: scenes,
    };
  }

  // ── Build Scene List in Sidebar ────────────
  function buildSceneList(data) {
    els.sceneList.innerHTML = '';

    data.scenes.forEach(function (scene, index) {
      var hasPano = !!PANO_MAP[scene._id];
      var card = document.createElement('button');
      card.className = 'scene-card' + (hasPano ? '' : ' disabled');
      card.setAttribute('data-scene-id', scene._id);

      var hotspotLabel = scene.hotspots.length === 1
        ? '1 punto de interés'
        : scene.hotspots.length + ' puntos de interés';

      card.innerHTML =
        '<div class="scene-card-thumb">' +
          '<span class="scene-card-icon">' + (hasPano ? '🌐' : '📷') + '</span>' +
        '</div>' +
        '<div class="scene-card-info">' +
          '<h3 class="scene-card-title">' + escapeHtml(scene.title) + '</h3>' +
          '<span class="scene-card-meta">' +
            hotspotLabel +
            (hasPano ? '' : ' · Sin panorama') +
          '</span>' +
        '</div>';

      if (hasPano) {
        card.addEventListener('click', function () {
          viewer.loadScene(scene._id);
          setActiveScene(scene._id);
          updateInfoBar(scene);
          // Collapse sidebar on mobile
          if (window.innerWidth < 768) {
            closeSidebar();
          }
        });
      }

      // Staggered entrance animation
      card.style.opacity = '0';
      card.style.transform = 'translateY(8px)';
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      setTimeout(function () {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 80 * index);

      els.sceneList.appendChild(card);
    });
  }

  function setActiveScene(sceneId) {
    var cards = els.sceneList.querySelectorAll('.scene-card');
    cards.forEach(function (card) {
      card.classList.toggle('active', card.getAttribute('data-scene-id') === sceneId);
    });
  }

  function updateInfoBar(scene) {
    els.sceneName.textContent = scene.title;
    var count = scene.hotspots.length;
    els.hotspotCount.textContent = count === 1
      ? '1 punto de interés'
      : count + ' puntos de interés';
  }

  // ── Sidebar Controls ───────────────────────
  function openSidebar() {
    els.sidebar.classList.add('open');
    sidebarOpen = true;
  }

  function closeSidebar() {
    els.sidebar.classList.remove('open');
    sidebarOpen = false;
  }

  function toggleSidebar() {
    if (sidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  // ── Utility ────────────────────────────────
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Event Binding ──────────────────────────
  function bindEvents() {
    // Sidebar toggle
    els.toggle.addEventListener('click', toggleSidebar);

    // Popup close
    els.popupClose.addEventListener('click', hidePopup);

    // Click outside popup to close
    els.popup.addEventListener('click', function (e) {
      if (e.target === els.popup) hidePopup();
    });

    // Keyboard: Escape closes popup or sidebar
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (els.popup.classList.contains('visible')) {
          hidePopup();
        } else if (sidebarOpen) {
          closeSidebar();
        }
      }
    });

    // Resize: adjust sidebar behavior
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (window.innerWidth >= 768 && !sidebarOpen) {
          // Don't force open on resize, user's choice is preserved
        }
      }, 150);
    });
  }

  // ── Initialize ─────────────────────────────
  async function init() {
    try {
      // 1. Load configuration
      projectData = await loadConfig();

      // 2. Build Pannellum config
      var config = buildViewerConfig(projectData);

      // 3. Initialize viewer
      viewer = pannellum.viewer('panorama', config);

      // 4. Handle load events
      viewer.on('load', function () {
        els.loader.classList.add('hidden');
      });
      
      // Fallback para forzar la ocultación en menos de 1 segundo
      setTimeout(function () {
        els.loader.classList.add('hidden');
      }, 800);

      viewer.on('scenechange', function (sceneId) {
        var scene = projectData.scenes.find(function (s) {
          return s._id === sceneId;
        });
        if (scene) {
          setActiveScene(sceneId);
          updateInfoBar(scene);
        }
      });

      // 5. Build sidebar content
      buildSceneList(projectData);

      // 6. Set initial state
      var firstScene = projectData.scenes.find(function (s) {
        return !!PANO_MAP[s._id];
      });
      if (firstScene) {
        updateInfoBar(firstScene);
        setActiveScene(firstScene._id);
      }

      // 7. Bind UI events
      bindEvents();

      // 8. Open sidebar on desktop by default
      if (window.innerWidth >= 768) {
        setTimeout(openSidebar, 600);
      }

    } catch (error) {
      console.error('Error al inicializar el visor 360°:', error);
      els.loader.innerHTML =
        '<div class="loader-content">' +
          '<div class="loader-error">' +
            '<p style="font-size:1.1rem;font-weight:600;">Error al cargar el recorrido</p>' +
            '<p class="loader-error-detail">' + escapeHtml(error.message) + '</p>' +
          '</div>' +
        '</div>';
    }
  }

  // ── Start ──────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
