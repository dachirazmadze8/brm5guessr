(function () {
  if (typeof MAPS === "undefined") {
    document.getElementById("gallery").textContent =
      "Could not load maps.js. Check that it is next to gallery.html.";
    return;
  }

  var LEVELS = ["easy", "medium", "hard", "extreme"];
  var current = "all";

  function $(id) {
    return document.getElementById(id);
  }

  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function cap(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function collect() {
    var items = [];
    Object.keys(MAPS).forEach(function (key) {
      if (current !== "all" && current !== key) return;
      MAPS[key].locations.forEach(function (loc, i) {
        var match = loc.image.match(/(\d+)\.\w+$/);
        var level = (loc.difficulty || "").toLowerCase();
        items.push({
          image: loc.image,
          level: LEVELS.indexOf(level) > -1 ? level : "",
          number: match ? match[1] : String(i + 1),
          map: MAPS[key].name
        });
      });
    });
    return items;
  }

  function buildTabs() {
    var box = $("mapselect");
    box.textContent = "";
    var tabs = [["all", "All maps"]].concat(
      Object.keys(MAPS).map(function (key) {
        return [key, MAPS[key].name];
      })
    );
    tabs.forEach(function (tab) {
      var b = make("button", "tab", tab[1]);
      b.type = "button";
      if (tab[0] === current) b.classList.add("active");
      b.addEventListener("click", function () {
        current = tab[0];
        render();
      });
      box.appendChild(b);
    });
  }

  function openPhoto(src) {
    $("bigphoto").src = src;
    $("lightbox").hidden = false;
  }

  function render() {
    buildTabs();
    var items = collect();
    var out = $("gallery");
    out.textContent = "";

    if (!items.length) {
      out.appendChild(make("p", "empty", "No photos for this map yet."));
      return;
    }

    LEVELS.concat([""]).forEach(function (level) {
      var list = items.filter(function (item) {
        return item.level === level;
      });
      if (!list.length) return;

      var section = make("section");
      var heading = make("h3", "level " + level, level ? cap(level) : "Unrated");
      heading.appendChild(document.createTextNode(" "));
      heading.appendChild(make("small", "", "(" + list.length + ")"));
      section.appendChild(heading);

      var grid = make("div", "grid");
      list.forEach(function (item) {
        var fig = make("figure");
        var img = make("img");
        img.loading = "lazy";
        img.alt = "Photo " + item.number;
        img.src = item.image;
        img.addEventListener("error", function () {
          img.classList.add("missing");
        });
        img.addEventListener("click", function () {
          openPhoto(item.image);
        });
        fig.appendChild(img);
        fig.appendChild(
          make("figcaption", "", current === "all" ? item.map + " #" + item.number : "#" + item.number)
        );
        grid.appendChild(fig);
      });
      section.appendChild(grid);
      out.appendChild(section);
    });
  }

  $("lightbox").addEventListener("click", function () {
    $("lightbox").hidden = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") $("lightbox").hidden = true;
  });

  render();
})();
