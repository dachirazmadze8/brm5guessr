(function () {
  if (typeof L === "undefined" || typeof MAPS === "undefined") {
    document.getElementById("photomsg").textContent =
      "Could not load game files. Check that the lib folder is next to game.html.";
    return;
  }

  var key = new URLSearchParams(location.search).get("map") || "nyc";
  var cfg = MAPS[key];
  if (!cfg) {
    location.href = "maps.html";
    return;
  }

  var MAX_ROUNDS = 5;
  var MAX_POINTS = 500;

  function $(id) {
    return document.getElementById(id);
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    return list;
  }

  function pad(n) {
    return ("00000" + Math.round(n)).slice(-5);
  }

  function gridText(latlng) {
    return pad(latlng.lng) + " " + pad(latlng.lat);
  }

  function parseGrid(text) {
    var parts = text.trim().split(/\s+/);
    return L.latLng(parseInt(parts[1], 10), parseInt(parts[0], 10));
  }

  function formatDistance(units) {
    var m = units * cfg.metersPerUnit;
    return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(2) + " km";
  }

  var locations = shuffle(cfg.locations.slice()).slice(0, MAX_ROUNDS);
  var round = 0;
  var total = 0;
  var answered = false;
  var guess = null;
  var guessMarker = null;
  var extras = [];
  var autoFit = true;
  var swapped = false;
  var resultBounds = null;

  var bounds = [[0, 0], [cfg.gridHeight, cfg.gridWidth]];
  var map = L.map("guessmap", {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 3,
    zoomSnap: 0,
    zoomDelta: 0.5,
    zoomControl: false,
    attributionControl: false,
    rotate: true,
    bearing: 0,
    rotateControl: false,
    touchRotate: false,
    maxBounds: bounds,
    maxBoundsViscosity: 1
  });
  L.control.zoom({ position: "bottomleft" }).addTo(map);
  L.imageOverlay(cfg.mapImage, bounds).addTo(map);
  map.fitBounds(bounds);
  map.setMinZoom(map.getBoundsZoom(bounds));

  map.on("dragstart", function () {
    autoFit = false;
  });
  $("guessmap").addEventListener("wheel", function () {
    autoFit = false;
  });
  $("guessmap").addEventListener("click", function (e) {
    if (e.target.closest(".leaflet-control-zoom")) autoFit = false;
  });

  map.on("click", function (e) {
    if (swapped) {
      swap();
      return;
    }
    if (answered) return;
    guess = e.latlng;
    if (guessMarker) {
      guessMarker.setLatLng(guess);
    } else {
      guessMarker = L.marker(guess).addTo(map);
    }
    $("guessbtn").disabled = false;
  });

  function limitZoom() {
    if (map.getBearing() !== 0) return;
    map.setMinZoom(map.getBoundsZoom(bounds));
  }

  function swap() {
    swapped = !swapped;
    var small = $("smallslot");
    var big = $("bigslot");
    if (swapped) {
      small.appendChild($("guessmap"));
      big.appendChild($("photowrap"));
    } else {
      small.appendChild($("photowrap"));
      big.appendChild($("guessmap"));
    }
    resetPhoto();
    setTimeout(function () {
      map.invalidateSize();
      limitZoom();
      if (resultBounds) {
        map.fitBounds(resultBounds, { padding: [90, 90], maxZoom: 2 });
      } else if (autoFit) {
        map.fitBounds(bounds);
      }
    }, 50);
  }

  var wrap = $("photowrap");
  var photo = $("photo");
  var view = { s: 1, tx: 0, ty: 0 };
  var dragging = false;
  var moved = false;
  var lastX = 0;
  var lastY = 0;
  photo.draggable = false;

  function applyView() {
    photo.style.transformOrigin = "0 0";
    photo.style.transform =
      "translate(" + view.tx + "px, " + view.ty + "px) scale(" + view.s + ")";
  }

  function clampView() {
    var r = wrap.getBoundingClientRect();
    view.tx = Math.min(0, Math.max(r.width - r.width * view.s, view.tx));
    view.ty = Math.min(0, Math.max(r.height - r.height * view.s, view.ty));
  }

  function resetPhoto() {
    view = { s: 1, tx: 0, ty: 0 };
    dragging = false;
    if (swapped) {
      applyView();
    } else {
      photo.style.transformOrigin = "50% 50%";
      photo.style.transform = "scale(1)";
    }
  }

  wrap.addEventListener("mousemove", function (e) {
    if (!swapped) {
      var r = wrap.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 100;
      var y = ((e.clientY - r.top) / r.height) * 100;
      photo.style.transformOrigin = x + "% " + y + "%";
      photo.style.transform = "scale(2.5)";
      return;
    }
    if (!dragging) return;
    if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) > 0) moved = true;
    view.tx += e.clientX - lastX;
    view.ty += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    clampView();
    applyView();
  });
  wrap.addEventListener("mouseleave", function () {
    dragging = false;
    if (!swapped) photo.style.transform = "scale(1)";
  });
  wrap.addEventListener("mousedown", function (e) {
    if (!swapped) return;
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  });
  window.addEventListener("mouseup", function () {
    dragging = false;
  });
  wrap.addEventListener(
    "wheel",
    function (e) {
      if (!swapped) return;
      e.preventDefault();
      var r = wrap.getBoundingClientRect();
      var cx = e.clientX - r.left;
      var cy = e.clientY - r.top;
      var next = Math.min(6, Math.max(1, view.s * Math.exp(-e.deltaY * 0.0015)));
      var k = next / view.s;
      view.tx = cx - (cx - view.tx) * k;
      view.ty = cy - (cy - view.ty) * k;
      view.s = next;
      clampView();
      applyView();
    },
    { passive: false }
  );
  wrap.addEventListener("click", function () {
    if (swapped && moved) {
      moved = false;
      return;
    }
    swap();
  });

  function refit() {
    map.invalidateSize();
    limitZoom();
    if (!answered && autoFit) map.fitBounds(bounds);
  }

  window.addEventListener("resize", refit);

  $("mapname").textContent = cfg.name;

  var rows = locations.map(function (loc, i) {
    var li = document.createElement("li");
    li.innerHTML =
      '<span class="n">' + (i + 1) + '.</span><span class="d">-</span><span class="p"></span>';
    $("rounds").appendChild(li);
    return li;
  });

  function updateProgress() {
    var done = round + (answered ? 1 : 0);
    $("barfill").style.width = (done / locations.length) * 100 + "%";
  }

  function startRound() {
    var loc = locations[round];
    answered = false;
    guess = null;
    resultBounds = null;
    if (swapped) swap();

    if (guessMarker) {
      map.removeLayer(guessMarker);
      guessMarker = null;
    }
    extras.forEach(function (layer) {
      map.removeLayer(layer);
    });
    extras = [];

    rows.forEach(function (li, i) {
      li.classList.toggle("current", i === round);
    });
    $("resulttext").textContent = "";
    $("guessbtn").hidden = false;
    $("guessbtn").disabled = true;
    $("nextbtn").hidden = true;
    $("total").textContent = total;
    updateProgress();

    $("photomsg").textContent = "";
    $("photo").src = loc.image;

    map.setBearing(0);
    $("rotate").value = 0;
    $("rotval").textContent = "0°";
    autoFit = true;
    setTimeout(refit, 50);
  }

  function submitGuess() {
    if (!guess || answered) return;
    answered = true;

    var loc = locations[round];
    var actual = parseGrid(loc.grid);
    var distance = map.distance(guess, actual);
    var points = Math.round(MAX_POINTS * Math.exp(-distance / cfg.scale));
    total += points;

    extras.push(
      L.circleMarker(actual, {
        radius: 10,
        color: "#fff",
        weight: 3,
        fillColor: "#2ecc71",
        fillOpacity: 1
      }).addTo(map)
    );
    extras.push(
      L.polyline([guess, actual], { color: "#fff", dashArray: "6 8" }).addTo(map)
    );

    resultBounds = L.latLngBounds([guess, actual]);
    if (swapped) swap();

    var row = rows[round];
    row.querySelector(".d").textContent = formatDistance(distance);
    row.querySelector(".p").textContent = "+" + points;

    $("total").textContent = total;
    $("resulttext").textContent =
      "Guess " + gridText(guess) + "  ·  Actual " + gridText(actual);
    $("guessbtn").hidden = true;
    $("nextbtn").hidden = false;
    $("nextbtn").textContent =
      round + 1 < locations.length ? "Next round" : "See results";
    updateProgress();

    map.setBearing(0);
    $("rotate").value = 0;
    $("rotval").textContent = "0°";
    setTimeout(function () {
      map.invalidateSize();
      limitZoom();
      map.fitBounds(L.latLngBounds([guess, actual]), {
        padding: [90, 90],
        maxZoom: 2
      });
    }, 100);
  }

  function nextRound() {
    round++;
    if (round >= locations.length) {
      $("finaltext").textContent =
        total + " / " + locations.length * MAX_POINTS;
      $("final").hidden = false;
      return;
    }
    startRound();
  }

  $("photo").addEventListener("error", function () {
    $("photomsg").textContent =
      "Image not found: " + locations[round].image;
  });
  $("rotate").addEventListener("input", function () {
    map.setBearing(Number(this.value));
    $("rotval").textContent = this.value + "°";
  });
  $("guessbtn").addEventListener("click", submitGuess);
  $("nextbtn").addEventListener("click", nextRound);
  $("again").addEventListener("click", function () {
    location.reload();
  });

  startRound();
})();
