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
    map.setMinZoom(map.getBoundsZoom(bounds));
  }

  function updateDragging() {
    if (map.getZoom() > map.getBoundsZoom(bounds) + 0.01) {
      map.dragging.enable();
    } else {
      map.dragging.disable();
    }
  }

  map.on("zoomend moveend", function () {
    var min = map.getBoundsZoom(bounds);
    if (map.getZoom() < min - 0.001) {
      map.setMinZoom(min);
      map.fitBounds(bounds, { animate: false });
    }
    updateDragging();
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
